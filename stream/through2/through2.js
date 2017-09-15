// [tip]  readable-stream的使用原因可以参见 https://r.va.gg/2014/06/why-i-dont-use-nodes-core-stream-module.html
var Transform = require('readable-stream/transform')
, inherits  = require('util').inherits
// [tip]  一个简单extend方法库，类似 Object.assign
, xtend     = require('xtend')

// [tip]  创建DestroyableTransform，继承Transform
// [doubt] destroy接口：stream3标准规范？为了方便操作？
function DestroyableTransform(opts) {
Transform.call(this, opts)
this._destroyed = false
}
inherits(DestroyableTransform, Transform)



// [tip]  transform流销毁接口
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
// [tip]  空的pipe，不进行处理，直接导流
function noop (chunk, enc, callback) {
callback(null, chunk)
}


// create a new export function, used by both the main export and
// the .ctor export, contains common logic for dealing with arguments
// [tip]  处理constructor中的输入参数，标准化输入的参数
// [tip]  through2中的constructor是真真的构造工具
// [tip]  through2函数其实只是参数校验的包装，叫wrap意义可能更明确
// [tip]  through2函数的功能：接受外界参数 ==> 参数校验与标准化处理 ==> 传递给construct构造真正的可用对象
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
// [tip]  其中
// [tip]  function (options, transform, flush) {
// [tip]    var t2 = new DestroyableTransform(options)
// [tip]  
// [tip]    t2._transform = transform
// [tip]  
// [tip]    if (flush)
// [tip]      t2._flush = flush
// [tip]  
// [tip]    return t2
// [tip]  }
// [tip]  这个匿名函数，可以看做真正的transform流的工厂函数
// [tip]  也许这么写会更清晰
// [tip]     ==> ==> ==> ==> ==> ==>
// [tip]  function wrap (construct) {
// [tip]    return function (options, transform, flush) {
// [tip]      //  options为function，即表示缺省options配置
// [tip]      if (typeof options == 'function') {
// [tip]        flush     = transform
// [tip]        transform = options
// [tip]        options   = {}
// [tip]      }
// [tip]  
// [tip]      if (typeof transform != 'function')
// [tip]        transform = noop
// [tip]  
// [tip]      if (typeof flush != 'function')
// [tip]        flush = null
// [tip]  
// [tip]      return construct(options, transform, flush)
// [tip]    }
// [tip]  }
// [tip]  function createTransform(options, transform, flush) {
// [tip]    var t2 = new DestroyableTransform(options)
// [tip]  
// [tip]    t2._transform = transform
// [tip]  
// [tip]    if (flush)
// [tip]      t2._flush = flush
// [tip]  
// [tip]    return t2
// [tip]  }
// [tip]  module.exports = wrap(createTransform)
// [tip]     ==> ==> ==> ==> ==> ==>
module.exports = through2(function (options, transform, flush) {
var t2 = new DestroyableTransform(options)

t2._transform = transform

if (flush)
  t2._flush = flush

return t2
})


// make me a reusable prototype that I can `new`, or implicitly `new`
// with a constructor call
// [tip]  创建一个继承自DestroyableTransform的类
// [tip]  并且为该类定义你自己的options, transform, flush（你自己定义的具有特殊行为的transform）
// [tip]  这样你就可以在其他地方复用这个类
// [tip]  Through2既是一个构造函数，也是一个工厂函数
// [tip]  同时，你可以通过给返回的Through2传入options进行调整
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


// [tip]  快速创建一个object模式的transform流
// [tip]  是一个简写模式，默认配置{ objectMode: true, highWaterMark: 16 }
module.exports.obj = through2(function (options, transform, flush) {
var t2 = new DestroyableTransform(xtend({ objectMode: true, highWaterMark: 16 }, options))

t2._transform = transform

if (flush)
  t2._flush = flush

return t2
})
