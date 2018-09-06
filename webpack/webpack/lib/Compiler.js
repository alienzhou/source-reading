/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const parseJson = require("json-parse-better-errors");
const asyncLib = require("neo-async");
const path = require("path");
const util = require("util");
const {
	Tapable,
	SyncHook,
	SyncBailHook,
	AsyncParallelHook,
	AsyncSeriesHook
} = require("tapable");

const Compilation = require("./Compilation");
const Stats = require("./Stats");
const Watching = require("./Watching");
const NormalModuleFactory = require("./NormalModuleFactory");
const ContextModuleFactory = require("./ContextModuleFactory");
const ResolverFactory = require("./ResolverFactory");

const RequestShortener = require("./RequestShortener");
const { makePathsRelative } = require("./util/identifier");
const ConcurrentCompilationError = require("./ConcurrentCompilationError");

/**
 * @typedef {Object} CompilationParams
 * @property {NormalModuleFactory} normalModuleFactory
 * @property {ContextModuleFactory} contextModuleFactory
 * @property {Set<string>} compilationDependencies
 */

/** @typedef {string|string[]} EntryValues */
/** @typedef {Record<string, EntryValues>} EntryOptionValues */

/**
 * @callback EntryOptionValuesFunction
 * @returns {EntryOptionValues | EntryValues} the computed value
 */

/** @typedef {EntryOptionValuesFunction | EntryOptionValues | EntryValues} EntryOptions */

class Compiler extends Tapable {
	constructor(context) {
		super();
		// [tip] 定义了compiler的所有hook，注意：排列顺序不为执行顺序
		this.hooks = {
			/** @type {SyncBailHook<Compilation>} */
			shouldEmit: new SyncBailHook(["compilation"]),
			/** @type {AsyncSeriesHook<Stats>} */
			done: new AsyncSeriesHook(["stats"]),
			/** @type {AsyncSeriesHook<>} */
			additionalPass: new AsyncSeriesHook([]),
			/** @type {AsyncSeriesHook<Compiler>} */
			beforeRun: new AsyncSeriesHook(["compiler"]),
			/** @type {AsyncSeriesHook<Compiler>} */
			run: new AsyncSeriesHook(["compiler"]),
			/** @type {AsyncSeriesHook<Compilation>} */
			emit: new AsyncSeriesHook(["compilation"]),
			/** @type {AsyncSeriesHook<Compilation>} */
			afterEmit: new AsyncSeriesHook(["compilation"]),

			/** @type {SyncHook<Compilation, CompilationParams>} */
			thisCompilation: new SyncHook(["compilation", "params"]),
			/** @type {SyncHook<Compilation, CompilationParams>} */
			compilation: new SyncHook(["compilation", "params"]),
			/** @type {SyncHook<NormalModuleFactory>} */
			normalModuleFactory: new SyncHook(["normalModuleFactory"]),
			/** @type {SyncHook<ContextModuleFactory>}  */
			contextModuleFactory: new SyncHook(["contextModulefactory"]),

			/** @type {AsyncSeriesHook<CompilationParams>} */
			beforeCompile: new AsyncSeriesHook(["params"]),
			/** @type {SyncHook<CompilationParams>} */
			compile: new SyncHook(["params"]),
			/** @type {AsyncParallelHook<Compilation>} */
			make: new AsyncParallelHook(["compilation"]),
			/** @type {AsyncSeriesHook<Compilation>} */
			afterCompile: new AsyncSeriesHook(["compilation"]),

			/** @type {AsyncSeriesHook<Compiler>} */
			watchRun: new AsyncSeriesHook(["compiler"]),
			/** @type {SyncHook<Error>} */
			failed: new SyncHook(["error"]),
			/** @type {SyncHook<string, string>} */
			invalid: new SyncHook(["filename", "changeTime"]),
			/** @type {SyncHook} */
			watchClose: new SyncHook([]),

			// TODO the following hooks are weirdly located here
			// TODO move them for webpack 5
			/** @type {SyncHook} */
			environment: new SyncHook([]),
			/** @type {SyncHook} */
			afterEnvironment: new SyncHook([]),
			/** @type {SyncHook<Compiler>} */
			afterPlugins: new SyncHook(["compiler"]),
			/** @type {SyncHook<Compiler>} */
			afterResolvers: new SyncHook(["compiler"]),
			/** @type {SyncBailHook<string, EntryOptions>} */
			entryOption: new SyncBailHook(["context", "entry"])
		};

		this._pluginCompat.tap("Compiler", options => {
			switch (options.name) {
				case "additional-pass":
				case "before-run":
				case "run":
				case "emit":
				case "after-emit":
				case "before-compile":
				case "make":
				case "after-compile":
				case "watch-run":
					options.async = true;
					break;
			}
		});

		/** @type {string=} */
		this.name = undefined;
		/** @type {Compilation=} */
		this.parentCompilation = undefined;
		/** @type {string} */
		this.outputPath = "";

		this.outputFileSystem = null;
		this.inputFileSystem = null;

		/** @type {string|null} */
		this.recordsInputPath = null;
		/** @type {string|null} */
		this.recordsOutputPath = null;
		this.records = {};
		/** @type {Map<string, number>} */
		this.fileTimestamps = new Map();
		/** @type {Map<string, number>} */
		this.contextTimestamps = new Map();
		/** @type {ResolverFactory} */
		this.resolverFactory = new ResolverFactory();

		// TODO remove in webpack 5
		this.resolvers = {
			normal: {
				plugins: util.deprecate((hook, fn) => {
					this.resolverFactory.plugin("resolver normal", resolver => {
						resolver.plugin(hook, fn);
					});
				}, "webpack: Using compiler.resolvers.normal is deprecated.\n" + 'Use compiler.resolverFactory.plugin("resolver normal", resolver => {\n  resolver.plugin(/* … */);\n}); instead.'),
				apply: util.deprecate((...args) => {
					this.resolverFactory.plugin("resolver normal", resolver => {
						resolver.apply(...args);
					});
				}, "webpack: Using compiler.resolvers.normal is deprecated.\n" + 'Use compiler.resolverFactory.plugin("resolver normal", resolver => {\n  resolver.apply(/* … */);\n}); instead.')
			},
			loader: {
				plugins: util.deprecate((hook, fn) => {
					this.resolverFactory.plugin("resolver loader", resolver => {
						resolver.plugin(hook, fn);
					});
				}, "webpack: Using compiler.resolvers.loader is deprecated.\n" + 'Use compiler.resolverFactory.plugin("resolver loader", resolver => {\n  resolver.plugin(/* … */);\n}); instead.'),
				apply: util.deprecate((...args) => {
					this.resolverFactory.plugin("resolver loader", resolver => {
						resolver.apply(...args);
					});
				}, "webpack: Using compiler.resolvers.loader is deprecated.\n" + 'Use compiler.resolverFactory.plugin("resolver loader", resolver => {\n  resolver.apply(/* … */);\n}); instead.')
			},
			context: {
				plugins: util.deprecate((hook, fn) => {
					this.resolverFactory.plugin("resolver context", resolver => {
						resolver.plugin(hook, fn);
					});
				}, "webpack: Using compiler.resolvers.context is deprecated.\n" + 'Use compiler.resolverFactory.plugin("resolver context", resolver => {\n  resolver.plugin(/* … */);\n}); instead.'),
				apply: util.deprecate((...args) => {
					this.resolverFactory.plugin("resolver context", resolver => {
						resolver.apply(...args);
					});
				}, "webpack: Using compiler.resolvers.context is deprecated.\n" + 'Use compiler.resolverFactory.plugin("resolver context", resolver => {\n  resolver.apply(/* … */);\n}); instead.')
			}
		};

		this.options = {};

		this.context = context;

		// [tip] 用于规范化与简化request（模块调用路径）
		this.requestShortener = new RequestShortener(context);

		/** @type {boolean} */
		this.running = false;
	}

	watch(watchOptions, handler) {
		if (this.running) return handler(new ConcurrentCompilationError());

		this.running = true;
		this.fileTimestamps = new Map();
		this.contextTimestamps = new Map();
		return new Watching(this, watchOptions, handler);
	}

	run(callback) {
		// [num] 1
		// [tip] 一个webpack实例不能重复运行
		if (this.running) return callback(new ConcurrentCompilationError());

		const finalCallback = (err, stats) => {
			this.running = false;

			if (callback !== undefined) return callback(err, stats);
		};

		const startTime = Date.now();

		this.running = true;

		// [num] 10
		const onCompiled = (err, compilation) => {
			if (err) return finalCallback(err);

			// [tip] 在shouldEmit hook触发后收集compilation信息生成Stats对象
			// [tip] hook shouldEmit - 这里通过在shouldEmit中返回false来跳过emit hook。这样打包后的文件就不会被产出为文件
			if (this.hooks.shouldEmit.call(compilation) === false) {
				// [tip] Stats对象：基于webpack打包后的compilation对象，来构造一个获取webpack打包信息的对象
				// [tip] 一些打包结果分析可以通过Stats对象获取，获取webpack内部模块、chunk信息的方法可以参考Stats
				const stats = new Stats(compilation);
				stats.startTime = startTime;
				stats.endTime = Date.now();
				// [tip] hook done - webpack运行完成，执行完钩子后就会执行调用webpack是注册的回调函数
				this.hooks.done.callAsync(stats, err => {
					if (err) return finalCallback(err);
					return finalCallback(null, stats);
				});
				return;
			}

			// [num] 11
			this.emitAssets(compilation, err => {
				if (err) return finalCallback(err);

				// [tip] hook needAdditionalPass - afterEmit后的钩子
				// [doubt] needAdditionalPass的钩子用处还有待进一步探究
				if (compilation.hooks.needAdditionalPass.call()) {
					compilation.needAdditionalPass = true;

					const stats = new Stats(compilation);
					stats.startTime = startTime;
					stats.endTime = Date.now();
					// [tip] hook done - webpack运行完成，执行完钩子后就会执行调用webpack是注册的回调函数
					this.hooks.done.callAsync(stats, err => {
						if (err) return finalCallback(err);

						// [tip] 这里又一次调用了this.compile，似乎符合“additional”的语义
						// [tip] hook additionalPass - additionalPass钩子在done之后才执行
						this.hooks.additionalPass.callAsync(err => {
							if (err) return finalCallback(err);
							this.compile(onCompiled);
						});
					});
					return;
				}

				// [num] 12
				this.emitRecords(err => {
					if (err) return finalCallback(err);

					const stats = new Stats(compilation);
					stats.startTime = startTime;
					stats.endTime = Date.now();

					// [tip] hook done - webpack运行完成，执行完钩子后就会执行调用webpack是注册的回调函数
					this.hooks.done.callAsync(stats, err => {
						if (err) return finalCallback(err);
						return finalCallback(null, stats);
					});
				});
			});
		};

		// [num] 2
		// [tip] hook beforeRun - 运行前的钩子
		this.hooks.beforeRun.callAsync(this, err => {
			if (err) return finalCallback(err);

			// [num] 3
			// [tip] hook run - 执行完run钩子后，webpack正式开始运行
			this.hooks.run.callAsync(this, err => {
				if (err) return finalCallback(err);

				// [num] 4
				this.readRecords(err => {
					if (err) return finalCallback(err);

					// [num] 5
					this.compile(onCompiled);
				});
			});
		});
	}

	runAsChild(callback) {
		this.compile((err, compilation) => {
			if (err) return callback(err);

			this.parentCompilation.children.push(compilation);
			for (const name of Object.keys(compilation.assets)) {
				this.parentCompilation.assets[name] = compilation.assets[name];
			}

			const entries = Array.from(
				compilation.entrypoints.values(),
				ep => ep.chunks
			).reduce((array, chunks) => {
				return array.concat(chunks);
			}, []);

			return callback(null, entries, compilation);
		});
	}

	purgeInputFileSystem() {
		if (this.inputFileSystem && this.inputFileSystem.purge) {
			this.inputFileSystem.purge();
		}
	}

	// [num] 11
	// [tip] 将webpack产出的emit输出到文件系统中
	emitAssets(compilation, callback) {
		let outputPath;

		const emitFiles = err => {
			if (err) return callback(err);

			// [tip] neo-async
			asyncLib.forEach(
				compilation.assets,
				// [tip] source: val, file: key
				(source, file, callback) => {
					let targetFile = file;
					// [tip] 标准化文件路径
					const queryStringIdx = targetFile.indexOf("?");
					if (queryStringIdx >= 0) {
						targetFile = targetFile.substr(0, queryStringIdx);
					}

					const writeOut = err => {
						if (err) return callback(err);
						const targetPath = this.outputFileSystem.join(
							outputPath,
							targetFile
						);
						// [tip] 避免在同一次编译中重复写文件
						if (source.existsAt === targetPath) {
							// [tip] source.emitted表示这次编译结果是否被发布出来
							source.emitted = false;
							return callback();
						}

						// [tip] 获取打包后文件内容，并通过配置的outputFileSystem进行写入
						// [tip] 因此可以通过修改outputFileSystem的实现，改变编译内容的输出方式
						let content = source.source();

						if (!Buffer.isBuffer(content)) {
							content = Buffer.from(content, "utf8");
						}

						source.existsAt = targetPath;
						source.emitted = true;
						this.outputFileSystem.writeFile(targetPath, content, callback);
					};

					// [tip] 包含文件夹的路径需要使用.mkdirp方法进行写入
					if (targetFile.match(/\/|\\/)) {
						const dir = path.dirname(targetFile);
						this.outputFileSystem.mkdirp(
							this.outputFileSystem.join(outputPath, dir),
							writeOut
						);
					} else {
						writeOut();
					}
				},
				err => {
					if (err) return callback(err);

					// [tip] hook afterEmit - 在此处触发afterEmit hook
					this.hooks.afterEmit.callAsync(compilation, err => {
						if (err) return callback(err);

						return callback();
					});
				}
			);
		};

		// [tip] hook emit - 钩子执行完毕后，会执行emitFiles方法，将打包结果写出到文件系统中，因此这是控制产出的最后的钩子
		this.hooks.emit.callAsync(compilation, err => {
			if (err) return callback(err);
			outputPath = compilation.getPath(this.outputPath);
			this.outputFileSystem.mkdirp(outputPath, emitFiles);
		});
	}

	// [num] 12
	// [tip] 将records信息写入到指定文件中
	emitRecords(callback) {
		if (!this.recordsOutputPath) return callback();
		const idx1 = this.recordsOutputPath.lastIndexOf("/");
		const idx2 = this.recordsOutputPath.lastIndexOf("\\");
		let recordsOutputPathDirectory = null;
		if (idx1 > idx2) {
			recordsOutputPathDirectory = this.recordsOutputPath.substr(0, idx1);
		} else if (idx1 < idx2) {
			recordsOutputPathDirectory = this.recordsOutputPath.substr(0, idx2);
		}

		const writeFile = () => {
			this.outputFileSystem.writeFile(
				this.recordsOutputPath,
				JSON.stringify(this.records, undefined, 2),
				callback
			);
		};

		if (!recordsOutputPathDirectory) {
			return writeFile();
		}
		this.outputFileSystem.mkdirp(recordsOutputPathDirectory, err => {
			if (err) return callback(err);
			writeFile();
		});
	}

	// [num] 4
	// [tip] 从指定的文件中读取records信息
	readRecords(callback) {
		if (!this.recordsInputPath) {
			this.records = {};
			return callback();
		}
		this.inputFileSystem.stat(this.recordsInputPath, err => {
			// It doesn't exist
			// We can ignore this.
			if (err) return callback();

			this.inputFileSystem.readFile(this.recordsInputPath, (err, content) => {
				if (err) return callback(err);

				try {
					// [tip] records绑定在this.records属性上
					this.records = parseJson(content.toString("utf-8"));
				} catch (e) {
					e.message = "Cannot parse records: " + e.message;
					return callback(e);
				}

				return callback();
			});
		});
	}

	createChildCompiler(
		compilation,
		compilerName,
		compilerIndex,
		outputOptions,
		plugins
	) {
		const childCompiler = new Compiler(this.context);
		if (Array.isArray(plugins)) {
			for (const plugin of plugins) {
				plugin.apply(childCompiler);
			}
		}
		for (const name in this.hooks) {
			if (
				![
					"make",
					"compile",
					"emit",
					"afterEmit",
					"invalid",
					"done",
					"thisCompilation"
				].includes(name)
			) {
				if (childCompiler.hooks[name]) {
					childCompiler.hooks[name].taps = this.hooks[name].taps.slice();
				}
			}
		}
		childCompiler.name = compilerName;
		childCompiler.outputPath = this.outputPath;
		childCompiler.inputFileSystem = this.inputFileSystem;
		childCompiler.outputFileSystem = null;
		childCompiler.resolverFactory = this.resolverFactory;
		childCompiler.fileTimestamps = this.fileTimestamps;
		childCompiler.contextTimestamps = this.contextTimestamps;

		const relativeCompilerName = makePathsRelative(this.context, compilerName);
		if (!this.records[relativeCompilerName]) {
			this.records[relativeCompilerName] = [];
		}
		if (this.records[relativeCompilerName][compilerIndex]) {
			childCompiler.records = this.records[relativeCompilerName][compilerIndex];
		} else {
			this.records[relativeCompilerName].push((childCompiler.records = {}));
		}

		childCompiler.options = Object.create(this.options);
		childCompiler.options.output = Object.create(childCompiler.options.output);
		for (const name in outputOptions) {
			childCompiler.options.output[name] = outputOptions[name];
		}
		childCompiler.parentCompilation = compilation;

		compilation.hooks.childCompiler.call(
			childCompiler,
			compilerName,
			compilerIndex
		);

		return childCompiler;
	}

	isChild() {
		return !!this.parentCompilation;
	}

	// [num] 8
	createCompilation() {
		return new Compilation(this);
	}

	// [num] 7
	newCompilation(params) {
		// [num] 8
		const compilation = this.createCompilation();
		compilation.fileTimestamps = this.fileTimestamps;
		compilation.contextTimestamps = this.contextTimestamps;
		compilation.name = this.name;
		compilation.records = this.records;
		compilation.compilationDependencies = params.compilationDependencies;
		// [tip] hook thisCompilation - 创建complition成功后调用
		this.hooks.thisCompilation.call(compilation, params);
		// [tip] hook compilation - 类似thisCompilation，不过是在其后调用
		this.hooks.compilation.call(compilation, params);
		return compilation;
	}

	// [num] 7
	createNormalModuleFactory() {
		const normalModuleFactory = new NormalModuleFactory(
			this.options.context,
			this.resolverFactory,
			this.options.module || {}
		);
		// [tip] hook normalModuleFactory
		this.hooks.normalModuleFactory.call(normalModuleFactory);
		return normalModuleFactory;
	}

	// [num] 8
	createContextModuleFactory() {
		const contextModuleFactory = new ContextModuleFactory(this.resolverFactory);
		// [tip] hook contextModuleFactory
		this.hooks.contextModuleFactory.call(contextModuleFactory);
		return contextModuleFactory;
	}

	// [num] 6
	// [tip] 注意，这里出现了两个类：NormalModuleFactory 和 ContextModuleFactory
	newCompilationParams() {
		const params = {
			// [num] 7
			normalModuleFactory: this.createNormalModuleFactory(),
			// [num] 8
			contextModuleFactory: this.createContextModuleFactory(),
			compilationDependencies: new Set()
		};
		return params;
	}

	// [num] 5
	compile(callback) {
		// [num] 6
		const params = this.newCompilationParams();
		// [tip] hook beforeCompile -
		this.hooks.beforeCompile.callAsync(params, err => {
			if (err) return callback(err);

			// [tip] hook compile - 执行完该钩子后，开始正式进行compile
			this.hooks.compile.call(params);

			// [num] 9
			const compilation = this.newCompilation(params);

			// [tip] hook make - 创建出（make）最终的comilation结果
			this.hooks.make.callAsync(compilation, err => {
				if (err) return callback(err);

				compilation.finish();

				compilation.seal(err => {
					if (err) return callback(err);

					// [tip] hook afterCompile - 编译完成，执行callback：onCompiled
					this.hooks.afterCompile.callAsync(compilation, err => {
						if (err) return callback(err);

						// [num] 10
						return callback(null, compilation);
					});
				});
			});
		});
	}
}

module.exports = Compiler;
