'use strict';

var fo = require('../../file-operations');
var readStream = require('../../src/read-contents/read-stream');

function writeStream(file, optResolver, onWritten) {
  var opt = {
    mode: file.stat.mode,
    // TODO: need to test this (node calls this `flags` property)
    flag: optResolver.resolve('flag', file),
  };

  // TODO: is this the best API?
  // [tip] 创建对目标文件的写入流（gulp.dest中指定的目标）
  var outStream = fo.createWriteStream(file.path, opt, onFlush);

  file.contents.once('error', onComplete);
  outStream.once('error', onComplete);
  outStream.once('finish', onComplete);

  // TODO: should this use a clone?
  // [tip] stream模式下，file.contents为文件内容的读取流，将该流导入目标文件写入流中
  file.contents.pipe(outStream);

  function onComplete(streamErr) {
    // Cleanup event handlers before closing
    file.contents.removeListener('error', onComplete);
    outStream.removeListener('error', onComplete);
    outStream.removeListener('finish', onComplete);

    // Need to guarantee the fd is closed before forwarding the error
    outStream.once('close', onClose);
    outStream.end();

    function onClose(closeErr) {
      onWritten(streamErr || closeErr);
    }
  }

  // Cleanup
  function onFlush(fd, callback) {
    // TODO: removing this before readStream because it replaces the stream
    file.contents.removeListener('error', onComplete);

    // TODO: this is doing sync stuff & the callback seems unnecessary
    // TODO: Replace the contents stream or use a clone?
    readStream(file, complete);

    function complete() {
      if (typeof fd !== 'number') {
        return callback();
      }

      fo.updateMetadata(fd, file, callback);
    }
  }

}

module.exports = writeStream;
