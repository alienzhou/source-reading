'use strict';

// [tip] Sink the output stream，用以启动stream在管道中流动
var lead = require('lead');
var pumpify = require('pumpify');
// [tip] mkdir -p，以流的形式
var mkdirpStream = require('fs-mkdirp-stream');
var createResolver = require('resolve-options');

var config = require('./options');
var prepare = require('./prepare');
var sourcemap = require('./sourcemap');
var writeContents = require('./write-contents');

var folderConfig = {
  outFolder: {
    type: 'string',
  },
};

function dest(outFolder, opt) {
  var optResolver = createResolver(config, opt);
  var folderResolver = createResolver(folderConfig, { outFolder: outFolder });

  function dirpath(file, callback) {
    var dirMode = optResolver.resolve('dirMode', file);

    callback(null, file.dirname, dirMode);
  }

  var saveStream = pumpify.obj(
    // [tip] 预处理file对象，为file修改路径相关的属性
    prepare(folderResolver, optResolver),
    // [tip] 输出sourceMap
    sourcemap(optResolver),
    // [tip] 目标文件创建，并以对象流的形式传送修改后的file对象
    mkdirpStream.obj(dirpath),
    // [tip] 向目标文件中写入文件内容
    writeContents(optResolver)
  );

  // Sink the output stream to start flowing
  // [tip] 通过将流导入空的目标来启动流的flow过程
  return lead(saveStream);
}

module.exports = dest;
