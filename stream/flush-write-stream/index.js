var stream = require('readable-stream')
var inherits = require('inherits')

var SIGNAL_FLUSH = new Buffer([0])

module.exports = WriteStream

// [tip] 构造函数，继承自readable-stream中的可读流
function WriteStream (opts, write, flush) {
  if (!(this instanceof WriteStream)) return new WriteStream(opts, write, flush)

  if (typeof opts === 'function') {
    flush = write
    write = opts
    opts = {}
  }

  stream.Writable.call(this, opts)

  this.destroyed = false
  this._worker = write || null
  this._flush = flush || null
}

inherits(WriteStream, stream.Writable)

// [tip] .obj 与 through2 的api一致，创建object模式的流
WriteStream.obj = function (opts, worker, flush) {
  // [tip] 开源库常见的参数调整方式
  if (typeof opts === 'function') return WriteStream.obj(null, opts, worker)
  if (!opts) opts = {}
  opts.objectMode = true
  return new WriteStream(opts, worker, flush)
}

// [tip] 重写WriteStream类的._write()方法，当调用.write()时会调用该方法
WriteStream.prototype._write = function (data, enc, cb) {
  // [tip] 当接收到SIGNAL_FLUSH信号时，会触发flush方法，否则是正常的write操作
  if (SIGNAL_FLUSH === data) this._flush(cb)
  else this._worker(data, enc, cb)
}

// [tip] 当调用.end()方法时，会先调用一下.flush()方法
WriteStream.prototype.end = function (data, enc, cb) {
  // [tip] .flush()方法不存在，直接调用.end()
  if (!this._flush) return stream.Writable.prototype.end.apply(this, arguments)
  if (typeof data === 'function') return this.end(null, null, data)
  if (typeof enc === 'function') return this.end(data, null, enc)
  if (data) this.write(data)
    // [tip] 通过向.write()中写入flush信号SIGNAL_FLUSH，调用flush方法
  if (!this._writableState.ending) this.write(SIGNAL_FLUSH)
  return stream.Writable.prototype.end.call(this, cb)
}

WriteStream.prototype.destroy = function (err) {
  if (this.destroyed) return
  this.destroyed = true
  if (err) this.emit('error', err)
  this.emit('close')
}
