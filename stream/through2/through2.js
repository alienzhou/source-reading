// [TIP]  readable-stream的使用原因可以参见 https://r.va.gg/2014/06/why-i-dont-use-nodes-core-stream-module.html
var Transform = require('readable-stream/transform')
, inherits  = require('util').inherits
// [TIP]  一个简单extend方法库，类似 Object.assign
, xtend     = require('xtend')

// [TIP]  创建DestroyableTransform，继承Transform
// [DOUBT] destroy接口：stream3标准规范？为了方便操作？
function DestroyableTransform(opts) {
Transform.call(this, opts)
this._destroyed = false
}
inherits(DestroyableTransform, Transform)



// [TIP]  transform流销毁接口
DestroyableTransform.prototype.destroy = function(err) {
if (this._destroyed) return
this._destroyed = true

var self = this
process.nextTick(function() {
  if (err)
    self.emit('error', err)
  self.emit('close')
})
}

// a noop _transform function
// [TIP]  空的pipe，不进行处理，直接导流
function noop (chunk, enc, callback) {
callback(null, chunk)
}


// create a new export function, used by both the main export and
// the .ctor export, contains common logic for dealing with arguments
// [TIP]  处理constructor中的输入参数，标准化输入的参数
// [TIP]  through2中的constructor是真真的构造工具
// [TIP]  through2函数其实只是参数校验的包装，叫wrap意义可能更明确
// [TIP]  through2函数的功能：接受外界参数 ==> 参数校验与标准化处理 ==> 传递给construct构造真正的可用对象
function through2 (construct) {
return function (options, transform, flush) {
  // options为function，即表示缺省options配置
  if (typeof options == 'function') {
    flush     = transform
    transform = options
    options   = {}
  }

  if (typeof transform != 'function')
    transform = noop

  if (typeof flush != 'function')
    flush = null

  return construct(options, transform, flush)
}
}


// main export, just make me a transform stream!
// [TIP]  其中
// [TIP]  function (options, transform, flush) {
// [TIP]    var t2 = new DestroyableTransform(options)
// [TIP]  
// [TIP]    t2._transform = transform
// [TIP]  
// [TIP]    if (flush)
// [TIP]      t2._flush = flush
// [TIP]  
// [TIP]    return t2
// [TIP]  }
// [TIP]  这个匿名函数，可以看做真正的transform流的工厂函数
// [TIP]  也许这么写会更清晰
// [TIP]     ==> ==> ==> ==> ==> ==>
// [TIP]  function wrap (construct) {
// [TIP]    return function (options, transform, flush) {
// [TIP]      // [TIP]  options为function，即表示缺省options配置
// [TIP]      if (typeof options == 'function') {
// [TIP]        flush     = transform
// [TIP]        transform = options
// [TIP]        options   = {}
// [TIP]      }
// [TIP]  
// [TIP]      if (typeof transform != 'function')
// [TIP]        transform = noop
// [TIP]  
// [TIP]      if (typeof flush != 'function')
// [TIP]        flush = null
// [TIP]  
// [TIP]      return construct(options, transform, flush)
// [TIP]    }
// [TIP]  }
// [TIP]  function createTransform(options, transform, flush) {
// [TIP]    var t2 = new DestroyableTransform(options)
// [TIP]  
// [TIP]    t2._transform = transform
// [TIP]  
// [TIP]    if (flush)
// [TIP]      t2._flush = flush
// [TIP]  
// [TIP]    return t2
// [TIP]  }
// [TIP]  module.exports = wrap(createTransform)
// [TIP]     ==> ==> ==> ==> ==> ==>
module.exports = through2(function (options, transform, flush) {
var t2 = new DestroyableTransform(options)

t2._transform = transform

if (flush)
  t2._flush = flush

return t2
})


// make me a reusable prototype that I can `new`, or implicitly `new`
// with a constructor call
// [TIP]  创建一个继承自DestroyableTransform的类
// [TIP]  并且为该类定义你自己的options, transform, flush（你自己定义的具有特殊行为的transform）
// [TIP]  这样你就可以在其他地方复用这个类
// [TIP]  Through2既是一个构造函数，也是一个工厂函数
// [TIP]  同时，你可以通过给返回的Through2传入options进行调整
module.exports.ctor = through2(function (options, transform, flush) {
function Through2 (override) {
  if (!(this instanceof Through2))
    return new Through2(override)

  this.options = xtend(options, override)

  DestroyableTransform.call(this, this.options)
}

inherits(Through2, DestroyableTransform)

Through2.prototype._transform = transform

if (flush)
  Through2.prototype._flush = flush

return Through2
})


// [TIP]  快速创建一个object模式的transform流
// [TIP]  是一个简写模式，默认配置{ objectMode: true, highWaterMark: 16 }
module.exports.obj = through2(function (options, transform, flush) {
var t2 = new DestroyableTransform(xtend({ objectMode: true, highWaterMark: 16 }, options))

t2._transform = transform

if (flush)
  t2._flush = flush

return t2
})
