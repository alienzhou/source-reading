'use strict';

var gs = require('glob-stream');
var pumpify = require('pumpify');
var toThrough = require('to-through');
var isValidGlob = require('is-valid-glob');
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
    // [tip] 先通过glob获取对象模式的流
    gs(glob, opt),
    // [tip] 将glob-stream下的对象包装为gulp的vinyl对象
    wrapVinyl(optResolver),
    // [tip] 解析软连接
    resolveSymlinks(optResolver),
    // [tip] 处理（去除）过期文件
    prepare(optResolver),
    // [tip] 读取文件，为文件设置contents属性（对于软链设置symlink属性）
    readContents(optResolver),
    // [tip] 使用vinyl-sourcemap为file添加sourceMap属性
    sourcemap(optResolver),
  ];

  var outputStream = pumpify.obj(streams);

  // [tip] 通过一系列管道，为gulp处理流程输入一个有效的vinyl对象
  return toThrough(outputStream);
}


module.exports = src;
