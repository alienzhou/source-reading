/*jshint node:true */

"use strict";

var eos = require('end-of-stream');
var consume = require('stream-consume');

// [tip] task：task function，任务所需执行的函数
module.exports = function (task, done) {
	var that = this, finish, cb, isDone = false, start, r;

	finish = function (err, runMethod) {
		var hrDuration = process.hrtime(start);

		if (isDone && !err) {
			err = new Error('task completion callback called too many times');
		}
		isDone = true;

		var duration = hrDuration[0] + (hrDuration[1] / 1e9); // seconds

		done.call(that, err, {
			duration: duration, // seconds
			hrDuration: hrDuration, // [seconds,nanoseconds]
			runMethod: runMethod
		});
	};

	cb = function (err) {
		finish(err, 'callback');
	};

	// [tip] 该处的task相当于gulp.task('taskname', [dep], function(cb) {})中的最后一个回调函数function(cb) {}
	try {
		start = process.hrtime();
		// [tip] 执行该任务的方法，若任务方法中显示调用了cb，则会在cb调用处认为任务结束（即调用finish方法）
		r = task(cb);
	} catch (err) {
		return finish(err, 'catch');
	}

	// [tip] 根据不同的类型（promise、stream、普通同步方法），使用不同的执行方式
	// [tip] 注意，这里的第三种情况是在gulp.task的第三个方法中不声明形参的情况，会将该方法认为是同步方法
	// [tip] 这就是为什么，在某些操作时，不显式调用cb或者返回流，则串行任务会变成类似并行
	// [tip] 任务在流开始flow时就会认为任务已结束（第三种情况，认为任务是同步的），而不会等流真正结束
	// [tip] 通过返回stream可以保证任务的串行
	// [tip] 同时可以发现，如果在任务方法中声明了形参cb，而在方法中不显示调用，则会导致任务一致处于未完成状态，需要注意这一点
	// [tip] 通过task执行后返回类型的不同 与 cb的调用，可以有效控制任务状态（是否完成），从而保证某些具有依赖关系的任务（本身为异步任务）串行执行
	if (r && typeof r.then === 'function') {
		// wait for promise to resolve
		// FRAGILE: ASSUME: Promises/A+, see http://promises-aplus.github.io/promises-spec/
		r.then(function () {
			finish(null, 'promise');
		}, function(err) {
			finish(err, 'promise');
		});

	} else if (r && typeof r.pipe === 'function') {
		// wait for stream to end

		eos(r, { error: true, readable: r.readable, writable: r.writable && !r.readable }, function(err){
			finish(err, 'stream');
		});

		// Ensure that the stream completes
        consume(r);

	} else if (task.length === 0) {
		// synchronous, function took in args.length parameters, and the callback was extra
		finish(null, 'sync');

	//} else {
		// FRAGILE: ASSUME: callback

	}
};
