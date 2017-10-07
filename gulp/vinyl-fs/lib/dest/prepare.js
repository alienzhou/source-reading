'use strict';

var path = require('path');

var fs = require('graceful-fs');
var through = require('through2');

function prepareWrite(folderResolver, optResolver) {
  if (!folderResolver) {
    throw new Error('Invalid output folder');
  }

  // [tip] 处理输入的file对象，标准化其属性
  // [tip] 为file添加一些路径相关属性，根据输入处理输出路径
  function normalize(file, enc, cb) {
    var mode = optResolver.resolve('mode', file);
    var cwd = path.resolve(optResolver.resolve('cwd', file));

    // [tip] 输出的目标文件夹
    var outFolderPath = folderResolver.resolve('outFolder', file);
    if (!outFolderPath) {
      return cb(new Error('Invalid output folder'));
    }
    var basePath = path.resolve(cwd, outFolderPath);
    var writePath = path.resolve(basePath, file.relative);

    // Wire up new properties
    file.stat = (file.stat || new fs.Stats());
    file.stat.mode = mode;
    file.cwd = cwd;
    file.base = basePath;
    file.path = writePath;

    cb(null, file);
  }

  return through.obj(normalize);
}

module.exports = prepareWrite;
