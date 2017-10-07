'use strict';

var util = require('util');
// [tip] 一个根据依赖关系并行执行任务的框架库
var Orchestrator = require('orchestrator');
var gutil = require('gulp-util');
var deprecated = require('deprecated');
// [tip] 目前版本的gulp依然使用0.3.0版本的vinyl-fs
// [tip] 0.3.0版本的vinyl-fs，代码量非常精简，也没有symlink相关操作
var vfs = require('vinyl-fs');

function Gulp() {
  Orchestrator.call(this);
}
util.inherits(Gulp, Orchestrator);

Gulp.prototype.task = Gulp.prototype.add;
Gulp.prototype.run = function() {
  // `run()` is deprecated as of 3.5 and will be removed in 4.0
  // Use task dependencies instead

  // Impose our opinion of "default" tasks onto orchestrator
  var tasks = arguments.length ? arguments : ['default'];

  this.start.apply(this, tasks);
};

// [tip] gulp.src和gulp.dest复用vinyl-fs的api
Gulp.prototype.src = vfs.src;
Gulp.prototype.dest = vfs.dest;

Gulp.prototype.watch = function(glob, opt, fn) {
  if (typeof opt === 'function' || Array.isArray(opt)) {
    fn = opt;
    opt = null;
  }

  // Array of tasks given
  // [tip] 如果直接给定一个任务数组，则执行这些任务
  if (Array.isArray(fn)) {
    return vfs.watch(glob, opt, function() {
      this.start.apply(this, fn);
    }.bind(this));
  }

  // [tip] glob-watcher
  return vfs.watch(glob, opt, fn);
};

// Let people use this class from our instance
Gulp.prototype.Gulp = Gulp;

// Deprecations
deprecated.field('gulp.env has been deprecated. ' +
  'Use your own CLI parser instead. ' +
  'We recommend using yargs or minimist.',
  console.warn,
  Gulp.prototype,
  'env',
  gutil.env
);

Gulp.prototype.run = deprecated.method('gulp.run() has been deprecated. ' +
  'Use task dependencies or gulp.watch task triggering instead.',
  console.warn,
  Gulp.prototype.run
);

var inst = new Gulp();
// [tip] 默认会导出一个Gulp的实例，因此如果需要使用Gulp类，则可以调用.gulp这个API
module.exports = inst;
