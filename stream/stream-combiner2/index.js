var PassThrough = require('readable-stream').PassThrough
var Readable = require('readable-stream').Readable
var duplexer = require('duplexer2')

module.exports = function () {
  var streams
  if(arguments.length == 1 && Array.isArray(arguments[0])) {
    streams = arguments[0]
  } else {
    streams = [].slice.call(arguments)
  }
  return combine(streams)
}

module.exports.obj = function () {
  var streams
  if(arguments.length == 1 && Array.isArray(arguments[0])) {
    streams = arguments[0]
  } else {
    streams = [].slice.call(arguments)
  }
  return combine(streams, { objectMode: true })
}

  
function combine (streams, opts) {

  // [tip] 将stream变为可读流
  for (var i = 0; i < streams.length; i++)
    streams[i] = wrap(streams[i], opts)

  // [tip] 流数目小于2时的特殊处理
  if(streams.length == 0)
    return new PassThrough(opts)
  else if(streams.length == 1)
    return streams[0]

  var first = streams[0]
    , last = streams[streams.length - 1]
    // [tip] 将首尾两个流合并为读写流
    , thepipe = duplexer(opts, first, last)

  //pipe all the streams together

  // [tip] 将中间的流用pipe连接
  function recurse (streams) {
    if(streams.length < 2)
      return
    streams[0].pipe(streams[1])
    recurse(streams.slice(1))
  }

  recurse(streams)

  function onerror () {
    var args = [].slice.call(arguments)
    args.unshift('error')
    thepipe.emit.apply(thepipe, args)
  }

  //es.duplex already reemits the error from the first and last stream.
  //add a listener for the inner streams in the pipeline.
  for(var i = 1; i < streams.length - 1; i ++)
    streams[i].on('error', onerror)

  return thepipe
}

// [tip] 如果stream不为可读流，将stream包装为可读流
function wrap (tr, opts) {
  // [tip] 检测stream是否为可读流
  if (typeof tr.read === 'function') return tr
  return new Readable(opts).wrap(tr)
}
