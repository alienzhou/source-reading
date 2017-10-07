/*jshint node:true */

"use strict";

var util = require('util');
var events = require('events');
var EventEmitter = events.EventEmitter;
var runTask = require('./lib/runTask');

var Orchestrator = function () {
	// [tip] 通过事件监听方式触发事件
	EventEmitter.call(this);
	// [tip] 执行完毕后的回调
	this.doneCallback = undefined; // call this when all tasks in the queue are done
	// [tip] 执行任务的序列
	this.seq = []; // the order to run the tasks
	// [tip] 记录所有的任务，每个任务对象包括name，dep，fn三个参数
	this.tasks = {}; // task objects: name, dep (list of names of dependencies), fn (the task to run)
	// [tip] 是否正在执行
	this.isRunning = false; // is the orchestrator running tasks? .start() to start, .stop() to stop
};
util.inherits(Orchestrator, EventEmitter);

	// [tip] 重置任务管理对象，停止任务，初始化所有内部属性
	Orchestrator.prototype.reset = function () {
		if (this.isRunning) {
			this.stop(null);
		}
		this.tasks = {};
		this.seq = [];
		this.isRunning = false;
		this.doneCallback = undefined;
		return this;
	};

	// [tip] 这里的fn就是gulp.task里面的具体任务函数
	// [tip] 注意，fn接受一个cb参数	
	Orchestrator.prototype.add = function (name, dep, fn) {
		// [tip] 参数调整与错误检验
		if (!fn && typeof dep === 'function') {
			fn = dep;
			dep = undefined;
		}
		dep = dep || [];
		fn = fn || function () {}; // no-op
		if (!name) {
			throw new Error('Task requires a name');
		}
		// validate name is a string, dep is an array of strings, and fn is a function
		if (typeof name !== 'string') {
			throw new Error('Task requires a name that is a string');
		}
		if (typeof fn !== 'function') {
			throw new Error('Task '+name+' requires a function that is a function');
		}
		if (!Array.isArray(dep)) {
			throw new Error('Task '+name+' can\'t support dependencies that is not an array of strings');
		}
		dep.forEach(function (item) {
			if (typeof item !== 'string') {
				throw new Error('Task '+name+' dependency '+item+' is not a string');
			}
		});
		this.tasks[name] = {
			fn: fn,
			dep: dep,
			name: name
		};
		return this;
	};
	Orchestrator.prototype.task = function (name, dep, fn) {
		if (dep || fn) {
			// alias for add, return nothing rather than this
			this.add(name, dep, fn);
		} else {
			return this.tasks[name];
		}
	};
	Orchestrator.prototype.hasTask = function (name) {
		return !!this.tasks[name];
	};
	// tasks and optionally a callback
	// [tip] 该方法可以接收一系列参数作为需要执行的任务名，最后一个参数可以是任务执行完成后的回调
	// [tip] 若不传任务名，则默认执行所有任务
	Orchestrator.prototype.start = function() {
		// [tip] names中记录需要执行的任务名称；seq中记录sequencify后的结果
		var args, arg, names = [], lastTask, i, seq = [];
		args = Array.prototype.slice.call(arguments, 0);
		if (args.length) {
			lastTask = args[args.length-1];
			// [tip] 最后一个参数为回调函数
			if (typeof lastTask === 'function') {
				this.doneCallback = lastTask;
				args.pop();
			}
			// [tip] 将一系列参数记录在names数组中
			for (i = 0; i < args.length; i++) {
				arg = args[i];
				if (typeof arg === 'string') {
					names.push(arg);
				} else if (Array.isArray(arg)) {
					names = names.concat(arg); // FRAGILE: ASSUME: it's an array of strings
				} else {
					throw new Error('pass strings or arrays of strings');
				}
			}
		}
		if (this.isRunning) {
			// reset specified tasks (and dependencies) as not run
			this._resetSpecificTasks(names);
		} else {
			// reset all tasks as not run
			this._resetAllTasks();
		}
		if (this.isRunning) {
			// if you call start() again while a previous run is still in play
			// prepend the new tasks to the existing task queue
			// [tip] 对于正在执行的任务系统，再次调用start方法时，会将该系统的序列化任务添加至队尾
			names = names.concat(this.seq);
		}
		// [tip] 若该方法（start）不接受参数，则names为空，默认执行所有任务
		if (names.length < 1) {
			// run all tasks
			// [tip] 将所有任务名称加入names数组中，使用sequencify将所有任务序列化
			for (i in this.tasks) {
				if (this.tasks.hasOwnProperty(i)) {
					names.push(this.tasks[i].name);
				}
			}
		}
		seq = [];
		try {
			// [tip] 序列化任务，result将写在seq中
			this.sequence(this.tasks, names, seq, []);
		} catch (err) {
			// Is this a known error?
			if (err) {
				if (err.missingTask) {
					this.emit('task_not_found', {message: err.message, task:err.missingTask, err: err});
				}
				if (err.recursiveTasks) {
					this.emit('task_recursion', {message: err.message, recursiveTasks:err.recursiveTasks, err: err});
				}
			}
			this.stop(err);
			return this;
		}
		this.seq = seq;
		this.emit('start', {message:'seq: '+this.seq.join(',')});
		if (!this.isRunning) {
			// [tip] RUNNING状态
			this.isRunning = true;
		}
		this._runStep();
		return this;
	};
	Orchestrator.prototype.stop = function (err, successfulFinish) {
		this.isRunning = false;
		if (err) {
			this.emit('err', {message:'orchestration failed', err:err});
		} else if (successfulFinish) {
			this.emit('stop', {message:'orchestration succeeded'});
		} else {
			// ASSUME
			err = 'orchestration aborted';
			this.emit('err', {message:'orchestration aborted', err: err});
		}
		if (this.doneCallback) {
			// Avoid calling it multiple times
			this.doneCallback(err);
		} else if (err && !this.listeners('err').length) {
			// No one is listening for the error so speak louder
			throw err;
		}
	};
	Orchestrator.prototype.sequence = require('sequencify');
	
	// [tip] 判断任务是否都被执行完
	Orchestrator.prototype.allDone = function () {
		var i, task, allDone = true; // nothing disputed it yet
		for (i = 0; i < this.seq.length; i++) {
			task = this.tasks[this.seq[i]];
			if (!task.done) {
				allDone = false;
				break;
			}
		}
		return allDone;
	};

	// [tip] 重置某一任务的执行情况相应信息
	Orchestrator.prototype._resetTask = function(task) {
		if (task) {
			if (task.done) {
				task.done = false;
			}
			delete task.start;
			delete task.stop;
			delete task.duration;
			delete task.hrDuration;
			delete task.args;
		}
	};

	// [tip] 调用_resetTask方法重置所有任务
	Orchestrator.prototype._resetAllTasks = function() {
		var task;
		for (task in this.tasks) {
			if (this.tasks.hasOwnProperty(task)) {
				this._resetTask(this.tasks[task]);
			}
		}
	};

	// [tip] 重置某些特定任务，包括这些任务的依赖
	Orchestrator.prototype._resetSpecificTasks = function (names) {
		var i, name, t;

		if (names && names.length) {
			for (i = 0; i < names.length; i++) {
				name = names[i];
				t = this.tasks[name];
				if (t) {
					this._resetTask(t);
					if (t.dep && t.dep.length) {
						this._resetSpecificTasks(t.dep); // recurse
					}
				//} else {
					// FRAGILE: ignore that the task doesn't exist
				}
			}
		}
	};

	// [tip] 顺序执行序列化后的任务，最大化并行，但由于某些任务其依赖的任务状态为完成，因此可能会咱不执行
	// [tip] 调用一次_runStep（遍历一次seq）并不能保证所有任务均会被执行
	Orchestrator.prototype._runStep = function () {
		var i, task;
		if (!this.isRunning) {
			return; // user aborted, ASSUME: stop called previously
		}
		for (i = 0; i < this.seq.length; i++) {
			task = this.tasks[this.seq[i]];
			// [tip] 检测任务状态
			if (!task.done && !task.running && this._readyToRunTask(task)) {
				this._runTask(task);
			}
			if (!this.isRunning) {
				return; // task failed or user aborted, ASSUME: stop called previously
			}
		}
		// [tip] 任务全部完成
		if (this.allDone()) {
			this.stop(null, true);
		}
	};

	// [tip] 判断该任务是否可以执行，最大化并行任务
	Orchestrator.prototype._readyToRunTask = function (task) {
		var ready = true, // no one disproved it yet
			i, name, t;
		if (task.dep.length) {
			// [tip] 只有当该任务的所有依赖都执行完毕后，该任务才可以执行
			for (i = 0; i < task.dep.length; i++) {
				name = task.dep[i];
				t = this.tasks[name];
				if (!t) {
					// FRAGILE: this should never happen
					this.stop("can't run "+task.name+" because it depends on "+name+" which doesn't exist");
					ready = false;
					break;
				}
				if (!t.done) {
					ready = false;
					break;
				}
			}
		}
		return ready;
	};
	Orchestrator.prototype._stopTask = function (task, meta) {
		task.duration = meta.duration;
		task.hrDuration = meta.hrDuration;
		task.running = false;
		task.done = true;
	};

	// [tip] 任务完成时，需要发布完成信息，信息会带有task name、duration、hrDuration、message四个信息项
	Orchestrator.prototype._emitTaskDone = function (task, message, err) {
		if (!task.args) {
			task.args = {task:task.name};
		}
		task.args.duration = task.duration;
		task.args.hrDuration = task.hrDuration;
		task.args.message = task.name+' '+message;
		var evt = 'stop';
		if (err) {
			task.args.err = err;
			evt = 'err';
		}
		// 'task_stop' or 'task_err'
		this.emit('task_'+evt, task.args);
	};
	Orchestrator.prototype._runTask = function (task) {
		var that = this;

		task.args = {task:task.name, message:task.name+' started'};
		this.emit('task_start', task.args);
		task.running = true;

		// [tip] meta，任务执行的相关信息：duration、hrDuration、runMethod
		runTask(task.fn.bind(this), function (err, meta) {
			// [tip] 任务完成，更新任务状态
			that._stopTask.call(that, task, meta);
			// [tip] 任务完成，发布任务信息
			that._emitTaskDone.call(that, task, meta.runMethod, err);
			// [tip] 任务执行出错，暂停该任务
			if (err) {
				return that.stop.call(that, err);
			}
			// [tip] 当每次有任务执行完成时，会再触发一次_runStep，执行seq中未完成的任务
			// [tip] 由于任务的依赖关系，每次执行_runStep遍历所有任务时，部分任务可能由于依赖项未执行完成所有无法执行
			// [tip] 每次有任务完成时，可能刚才由于依赖无法执行的任务已经可以执行，因此需要重新触发_runStep，保证所有任务均会被执行
			that._runStep.call(that);
		});
	};

// FRAGILE: ASSUME: this list is an exhaustive list of events emitted
var events = ['start','stop','err','task_start','task_stop','task_err','task_not_found','task_recursion'];

// [tip] 添加事件监听
var listenToEvent = function (target, event, callback) {
	target.on(event, function (e) {
		e.src = event;
		callback(e);
	});
};

	// [tip] 添加各类事件的监听
	Orchestrator.prototype.onAll = function (callback) {
		var i;
		if (typeof callback !== 'function') {
			throw new Error('No callback specified');
		}

		for (i = 0; i < events.length; i++) {
			listenToEvent(this, events[i], callback);
		}
	};

module.exports = Orchestrator;
