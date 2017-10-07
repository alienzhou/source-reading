'use strict';

var fo = require('../../file-operations');

function writeBuffer(file, optResolver, onWritten) {
  var opt = {
    mode: file.stat.mode,
    flag: optResolver.resolve('flag', file),
  };

  // [tip] 重写了writeFile，在写入完毕后，可以在onWriteFile的回调中获得该新文件的文件描述符
  // [tip] buffer模式下，file.contents为包含文件内容的buffer
  fo.writeFile(file.path, file.contents, opt, onWriteFile);

  // [tip] fd，该文件的文件描述符
  function onWriteFile(writeErr, fd) {
    if (writeErr) {
      return fo.closeFd(writeErr, fd, onWritten);
    }

    // [tip] 更新文件信息
    fo.updateMetadata(fd, file, onUpdate);

    function onUpdate(updateErr) {
      fo.closeFd(updateErr, fd, onWritten);
    }
  }

}

module.exports = writeBuffer;
