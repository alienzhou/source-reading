/*jshint node:true */

"use strict";

var sequence = function (tasks, names, results, missing, recursive, nest) {
	names.forEach(function (name) {
		if (results.indexOf(name) !== -1) {
			return; // de-dup results
		}
		var node = tasks[name];
		// [tip] 无该任务节点
		if (!node) {
			missing.push(name);
		// [tip] 在nest中发现与当前name相同的task
		// [tip] 说明该task在父(祖先)节点与子节点中均存在，因此形成了循环依赖，需要记录该循环依赖
		} else if (nest.indexOf(name) > -1) {
			nest.push(name);
			recursive.push(nest.slice(0));
			nest.pop(name);
		// [tip] 遍历叶子节点
		// [tip] 使用nest来记录一系列父(祖先)节点，该节点正在被循环遍历其叶子节点
		// [tip] 其叶子节点遍历完成后父(祖先)节点出栈
		} else if (node.dep.length) {
			nest.push(name);
			sequence(tasks, node.dep, results, missing, recursive, nest); // recurse
			nest.pop(name);
		}
		// [tip] 后续遍历该树
		results.push(name);
	});
};

// tasks: object with keys as task names
// names: array of task names
module.exports = function (tasks, names) {
	var results = []; // the final sequence
	var missing = []; // missing tasks
	var recursive = []; // recursive task dependencies

	sequence(tasks, names, results, missing, recursive, []);

	if (missing.length || recursive.length) {
		results = []; // results are incomplete at best, completely wrong at worst, remove them to avoid confusion
	}

	return {
		sequence: results,
		missingTasks: missing,
		recursiveDependencies: recursive
	};
};
