'use strict';

// [tip] 根据配置类型，处理不同的file(vinyl)对象，并将所需内容添加到file中，并传入下一个pipe

var through = require('through2');

// [tip] 目前啥都没做。。。主要是为了防止传入目录是产生错误
var readDir = require('./read-dir');
// [tip] 将file(vinyl)对象的contents属性设置为一个文件可读流
var readStream = require('./read-stream');
// [tip] 将file(vinyl)对象的contents属性设置为实际文件内容
var readBuffer = require('./read-buffer');
// [tip] 获取软链目标，并存储在file(vinyl)对象上
var readSymbolicLink = require('./read-symbolic-link');

function readContents(optResolver) {

  function readFile(file, enc, callback) {

    // Skip reading contents if read option says so
    // [tip] 通过配置read选项，控制是否读取文件
    var read = optResolver.resolve('read', file);
    if (!read) {
      return callback(null, file);
    }

    // Don't fail to read a directory
    if (file.isDirectory()) {
      return readDir(file, optResolver, onRead);
    }

    // Process symbolic links included with `resolveSymlinks` option
    if (file.stat && file.stat.isSymbolicLink()) {
      return readSymbolicLink(file, optResolver, onRead);
    }

    // Read and pass full contents
    var buffer = optResolver.resolve('buffer', file);
    if (buffer) {
      return readBuffer(file, optResolver, onRead);
    }

    // Don't buffer anything - just pass streams
    return readStream(file, optResolver, onRead);

    // This is invoked by the various readXxx modules when they've finished
    // reading the contents.
    // [tip] 各类处理模块均会调用，传递处理后的file(vinyl)对象
    function onRead(readErr) {
      if (readErr) {
        return callback(readErr);
      }
      return callback(null, file);
    }
  }

  return through.obj(readFile);
}

module.exports = readContents;
