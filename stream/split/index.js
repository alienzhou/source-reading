//filter will reemit the data if cb(err,pass) pass is truthy

// reduce is more tricky
// maybe we want to group the reductions or emit progress updates occasionally
// the most basic reduce just emits one 'data' event after it has received 'end'


var through = require('through')
var Decoder = require('string_decoder').StringDecoder

module.exports = split

//TODO pass in a function to map across the lines.
// [tip] maxLength 用于限制split后每一块的大小，超长后会触发error事件
function split (matcher, mapper, options) {
  var decoder = new Decoder()
  var soFar = ''
  var maxLength = options && options.maxLength;
  var trailing = options && options.trailing === false ? false : true
  if('function' === typeof matcher)
    mapper = matcher, matcher = null
  if (!matcher)
    // [tip] 默认为换行符 \r?\n
    matcher = /\r?\n/

  // [tip] emit data
  function emit(stream, piece) {
    // [tip] 如果有mapper函数，则先对chunk进行map
    if(mapper) {
      try {
        piece = mapper(piece)
      }
      catch (err) {
        return stream.emit('error', err)
      }
      if('undefined' !== typeof piece)
        stream.queue(piece)
    }
    else
      stream.queue(piece)
  }

  function next (stream, buffer) {
    var pieces = ((soFar != null ? soFar : '') + buffer).split(matcher)
    // [tip] soFar：在每次分割时，会剩下最后一部分（数组最后一位）
    // [tip] 该部分是自然被分割，而非是完整分割符之间的内容
    // [tip] 因此保留下来，加在下次待分割字串的头部一起操作
    // [tip] 因此，如果该部分超过maxLength，则表示分隔符间内容过长，触发error事件
    soFar = pieces.pop()

    // [tip] 超过长度限制会报错
    if (maxLength && soFar.length > maxLength)
      return stream.emit('error', new Error('maximum buffer reached'))

    // [tip] 将其余完整的分割部分作为新chunk进行处理
    for (var i = 0; i < pieces.length; i++) {
      var piece = pieces[i]
      emit(stream, piece)
    }
  }

  return through(function (b) {
    // [tip] decoder.write(b)返回解码后的字符串
    next(this, decoder.write(b))
  },
  function () {
    if(decoder.end)
      next(this, decoder.end())
    // [tip] 是否需要处理最后切分剩余的尾部数据，否则忽略该部分数据
    if(trailing && soFar != null)
      emit(this, soFar)
    this.queue(null)
  })
}
