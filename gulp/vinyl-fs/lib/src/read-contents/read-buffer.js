'use strict';

var fs = require('graceful-fs');
// [tip] BOM（Byte Order Mark），字节顺序标记
// [tip] 出现在文本文件头部，Unicode编码标准中用于标识文件是采用哪种格式的编码
var removeBomBuffer = require('remove-bom-buffer');

function bufferFile(file, optResolver, onRead) {
  fs.readFile(file.path, onReadFile);

  function onReadFile(readErr, data) {
    if (readErr) {
      return onRead(readErr);
    }

    var removeBOM = optResolver.resolve('removeBOM', file);
    if (removeBOM) {
      file.contents = removeBomBuffer(data);
    } else {
      file.contents = data;
    }

    onRead();
  }
}

module.exports = bufferFile;
