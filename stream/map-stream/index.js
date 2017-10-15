//filter will reemit the data if cb(err,pass) pass is truthy

// reduce is more tricky
// maybe we want to group the reductions or emit progress updates occasionally
// the most basic reduce just emits one 'data' event after it has recieved 'end'


var Stream = require('stream').Stream


//create an event stream and apply function to each .write
//emitting each response as data
//unless it's an empty callback

module.exports = function (mapper, opts) {

  var stream = new Stream()
    , inputs = 0
    , outputs = 0
    // [tip] stream内部状态
    , ended = false
    , paused = false
    , destroyed = false
    // [tip] 记录上一次写入的序号
    , lastWritten = 0
    , inNext = false

  opts = opts || {};
  var errorEventName = opts.failures ? 'failure' : 'error';

  // Items that are not ready to be written yet (because they would come out of
  // order) get stuck in a queue for later.
  var writeQueue = {}

  // [tip] 可读可写Duplex
  stream.writable = true
  stream.readable = true

  function queueData (data, number) {
    // [tip] 只处理本次需要处理的数据，对于其他数据，则先缓存起来
    // [tip] 上一次写入序号+1，得到本次应该写入的内容（序号）
    var nextToWrite = lastWritten + 1

    if (number === nextToWrite) {
      // If it's next, and its not undefined write it
      if (data !== undefined) {
        stream.emit.apply(stream, ['data', data])
      }
      // [tip] 写入，lastWritten与nextToWrite都需要加一
      lastWritten ++
      nextToWrite ++
    } else {
      // Otherwise queue it for later.
      // [tip] 保存当前数据，以序号作为索引
      writeQueue[number] = data
    }

    // If the next value is in the queue, write it
    // [tip] 如果writeQueue中缓存了这次（lastWritten + 1）的数据，则调用一次queueData
    if (writeQueue.hasOwnProperty(nextToWrite)) {
      var dataToWrite = writeQueue[nextToWrite]
      delete writeQueue[nextToWrite]
      return queueData(dataToWrite, nextToWrite)
    }

    outputs ++
    // [tip] 当inputs与outputs相同时，表明已无缓存数据
    // [tip] 当writeQueue中仍有缓存数据时，首先需要将writeQueue中的数据消化完
    // [tip] 消化完毕后才去处理暂停（pause）与完毕（end）事件
    // [tip] 对于暂停的流，通过drain事件触发继续写入
    // [tip] 对于结束的流，调用end方法
    if(inputs === outputs) {
      if(paused) paused = false, stream.emit('drain') //written all the incoming events
      if(ended) end()
    }
  }

  function next (err, data, number) {
    if(destroyed) return
    inNext = true

    // [tip] 对于得到的正常数据，调用queueData来处理
    if (!err || opts.failures) {
      queueData(data, number)
    }

    // [tip] 出错后发布错误事件
    if (err) {
      stream.emit.apply(stream, [ errorEventName, err ]);
    }

    inNext = false;
  }

  // Wrap the mapper function by calling its callback with the order number of
  // the item in the stream.
  // [tip] 包裹用户传入的mapper函数，将库的特殊处理注入其中
  function wrappedMapper (input, number, callback) {
    return mapper.call(null, input, function(err, data){
      callback(err, data, number)
    })
  }

  stream.write = function (data) {
    if(ended) throw new Error('map stream is not writable')
    inNext = false
    // [tip] 写入时inputs加一
    inputs ++

    try {
      //catch sync errors and handle them like async errors
      var written = wrappedMapper(data, inputs, next)
      paused = (written === false)
      return !paused
    } catch (err) {
      //if the callback has been called syncronously, and the error
      //has occured in an listener, throw it again.
      if(inNext)
        throw err
      next(err)
      return !paused
    }
  }

  function end (data) {
    //if end was called with args, write it, 
    ended = true //write will emit 'end' if ended is true
    stream.writable = false
    // [tip] 若包含data，则先将data照常处理
    if(data !== undefined) {
      return queueData(data, inputs)
    // [tip] 等待所有数据均被处理完成
    } else if (inputs == outputs) { //wait for processing 
      stream.readable = false, stream.emit('end'), stream.destroy() 
    }
  }

  stream.end = function (data) {
    if(ended) return
    end(data)
  }

  stream.destroy = function () {
    ended = destroyed = true
    stream.writable = stream.readable = paused = false
    process.nextTick(function () {
      stream.emit('close')
    })
  }
  stream.pause = function () {
    paused = true
  }

  stream.resume = function () {
    paused = false
  }

  return stream
}




