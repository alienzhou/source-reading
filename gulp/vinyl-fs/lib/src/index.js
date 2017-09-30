'use strict';
// [tip] 使用glob选择文件，生成object stream，每个object是一个类似glob的对象，保存cwd, base, path信息
// [tip] {"cwd":"/Users/alienzhou/stream","base":"/Users/alienzhou/stream/txt","path":"/Users/alienzhou/stream/txt/readline"}
var gs = require('glob-stream');
// [tip] 会将一系列stream连接成一个duplex流
var pumpify = require('pumpify');
// [tip] 把一个可读流包装成transform流
var toThrough = require('to-through');
var isValidGlob = require('is-valid-glob');
// [tip] 管理配置对象的工具，可以定义各个配置属性的类型、值等等，并通过其api获取配置属性
var createResolver = require('resolve-options');

var config = require('./options');
var prepare = require('./prepare');
var wrapVinyl = require('./wrap-vinyl');
var sourcemap = require('./sourcemap');
var readContents = require('./read-contents');
var resolveSymlinks = require('./resolve-symlinks');

function src(glob, opt) {
  var optResolver = createResolver(config, opt);

  if (!isValidGlob(glob)) {
    throw new Error('Invalid glob argument: ' + glob);
  }

  var streams = [
    // [tip] 通过glob获取文件信息
    gs(glob, opt),
    // [tip] 将文件信息对象变为一个vinyl对象
    wrapVinyl(optResolver),
    // [tip] 解析软链
    resolveSymlinks(optResolver),
    // [tip] 丢弃过期的文件对象
    prepare(optResolver),
    readContents(optResolver),
    sourcemap(optResolver),
  ];

  var outputStream = pumpify.obj(streams);

  return toThrough(outputStream);
}


module.exports = src;
