'use strict';

// [tip] 处理任务树为gulp使用的格式
module.exports = function(tasks) {
  return Object.keys(tasks)
    .reduce(function(prev, task) {
      prev.nodes.push({
        label: task,
        nodes: tasks[task].dep,
      });
      return prev;
    }, {
      nodes: [],
    });
};
