# source-reading 源码阅读
source code reading (e.g. frontend, nodejs)
## 源码列表
### stream 流操作
- [x] [through2](https://github.com/rvagg/through2): Tiny wrapper around Node streams2 Transform to avoid explicit subclassing noise.
- [x] [event-stream](https://github.com/dominictarr/event-stream): EventStream is like functional programming meets IO.
- [x] [split](https://github.com/dominictarr/split): Break up a stream and reassemble it so that each line is a chunk. matcher may be a String, or a RegExp.
- [x] [map-stream](https://github.com/dominictarr/map-stream): Refactored out of event-stream.
- [x] [pause-stream](https://github.com/dominictarr/pause-stream): This is a Stream that will strictly buffer when paused. Connect it to anything you need buffered.
- [x] [stream-combiner2](https://github.com/substack/stream-combiner2): This is a sequel to stream-combiner for streams3.
- [x] [flush-write-stream](https://github.com/mafintosh/flush-write-stream): A write stream constructor that supports a flush function that is called before finish is emitted.
- [x] [pumpify](https://github.com/mafintosh/pumpify): Combine an array of streams into a single duplex stream using pump and duplexify.

### gulp 相关
- [x] [vinyl](https://github.com/gulpjs/vinyl): Virtual file format.
- [x] [vinyl-fs](https://github.com/gulpjs/vinyl-fs)
- [ ] [vinyl-sourcemap](https://github.com/gulpjs/vinyl-sourcemap): Add/write sourcemaps to/from Vinyl files.
- [x] [gulp](https://github.com/gulpjs/gulp): The streaming build system.
- [ ] ~~[gulp-util](https://github.com/gulpjs/gulp-util): [deprecated]~~
- [ ] [gulp-md5-plus](https://github.com/wpfpizicai/gulp-md5-plus): md5 plugin for gulp ,md5 the static files(eg javascript style image files) ;then replace the filenames in css or the html if needed by passing the file or dir in the second parameter.
- [x] [gulp-rename](https://github.com/hparra/gulp-rename): gulp-rename is a gulp plugin to rename files easily.
- [ ] [run-sequence](https://github.com/OverZealous/run-sequence): Run a series of dependent gulp tasks in order.
- [x] [orchestrator](https://github.com/robrich/orchestrator): A module for sequencing and executing tasks and dependencies in maximum concurrency.
- [x] [sequencify](https://github.com/robrich/sequencify): A module for sequencing tasks and dependencies.

### visualization 可视化
- [ ] [D3](https://github.com/d3/d3): D3 (or D3.js) is a JavaScript library for visualizing data using web standards. D3 helps you bring data to life using SVG, Canvas and HTML.

### server
- [ ] [express](https://github.com/expressjs/express): Fast, unopinionated, minimalist web framework for node.

### redux相关
- [ ] [redux](https://github.com/reactjs/redux): Redux is a predictable state container for JavaScript apps.
- [ ] [redux-saga](https://github.com/redux-saga/redux-saga): redux-saga is a library that aims to make application side effects (i.e. asynchronous things like data fetching and impure things like accessing the browser cache) easier to manage, more efficient to execute, simple to test, and better at handling failures.

### 异步数据
- [ ] [axios](https://github.com/axios/axios): Promise based HTTP client for the browser and node.js.
- [ ] [RxJS](https://github.com/reactivex/rxjs): The Reactive Extensions for JavaScript.

### Performace
- [x] [fastdom](https://github.com/wilsonpage/fastdom): Eliminates layout thrashing by batching DOM measurement and mutation tasks.

### fis
- [ ] [fis3](https://github.com/fex-team/fis3)面向前端的工程构建系统。
