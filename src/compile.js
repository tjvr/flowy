import {addEvents} from "./events";

import {bySpec, typeOf, literal} from "./prims";

function assert(x) {
  if (!x) throw "Assertion failed!";
}

export const compile = (function() {
  'use strict';

  var LOG_PRIMITIVES;
  var DEBUG;
  LOG_PRIMITIVES = true;
  DEBUG = true;

  var warnings;
  var warn = function(message) {
    warnings[message] = (warnings[message] || 0) + 1;
  };

  var compileNode = function(computed) {
    var nextLabel = function() {
      return computed.fns.length + fns.length;
    };

    var label = function() {
      var id = nextLabel();
      fns.push(source.length);
      return id;
    };

    var tmps = 0;
    var genSym = function() {
      return '_tmp' + (++tmps);
    };

    var queue = function(id) {
      source += 'queue(' + id + ');\n';
      source += 'return;\n';
    };

    var forceQueue = function(id) {
      source += 'forceQueue(' + id + ');\n';
      source += 'return;\n';
    };

    var await = function(thread) {
      var id = nextLabel();
      source += 'if (await(' + thread + ', ' + id + ')) return;\n';
      fns.push(source.length);
    };


    var emit = function(value) {
      source += 'emit(' + value + ');\n';
      var id = label();
      //forceQueue(id);
    };

    var val = function(e, usenum, usebool) {
      var v;
      if (typeof e === 'number' || typeof e === 'boolean') {

        return '' + e;

      } else if (typeof e === 'string') {

        return '"' + e
          .replace(/\\/g, '\\\\')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/"/g, '\\"')
          .replace(/\{/g, '\\x7b')
          .replace(/\}/g, '\\x7d') + '"';

      } else {

        warn('Undefined val: ' + e[0]);

      }
    };


    var DIGIT = /\d/;
    var boolval = function(e) {

      if (e[0] === 'list:contains:') { /* Data */

        return 'listContains(' + listRef(e[1]) + ', ' + val(e[2]) + ')';

      } else if (e[0] === '<' || e[0] === '>') { /* Operators */

        if (typeof e[1] === 'string' && DIGIT.test(e[1]) || typeof e[1] === 'number') {
          var less = e[0] === '<';
          var x = e[1];
          var y = e[2];
        } else if (typeof e[2] === 'string' && DIGIT.test(e[2]) || typeof e[2] === 'number') {
          var less = e[0] === '>';
          var x = e[2];
          var y = e[1];
        }
        var nx = +x;
        if (x == null || nx !== nx) {
          return '(compare(' + val(e[1]) + ', ' + val(e[2]) + ') === ' + (e[0] === '<' ? -1 : 1) + ')';
        }
        return (less ? 'numLess' : 'numGreater') + '(' + nx + ', ' + val(y) + ')';

      } else if (e[0] === '=') {

        if (typeof e[1] === 'string' && DIGIT.test(e[1]) || typeof e[1] === 'number') {
          var x = e[1];
          var y = e[2];
        } else if (typeof e[2] === 'string' && DIGIT.test(e[2]) || typeof e[2] === 'number') {
          var x = e[2];
          var y = e[1];
        }
        var nx = +x;
        if (x == null || nx !== nx) {
          return '(equal(' + val(e[1]) + ', ' + val(e[2]) + '))';
        }
        return '(numEqual(' + nx + ', ' + val(y) + '))';

      }
    };

    var bool = function(e) {
      if (typeof e === 'boolean') {
        return e;
      }
      if (typeof e === 'number' || typeof e === 'string') {
        return +e !== 0 && e !== '' && e !== 'false' && e !== false;
      }
      var v = boolval(e);
      return v != null ? v : 'bool(' + val(e, false, true) + ')';
    };

    var num = function(e) {
      if (typeof e === 'number') {
        return e || 0;
      }
      if (typeof e === 'boolean' || typeof e === 'string') {
        return +e || 0;
      }
      var v = numval(e);
      return v != null ? v : '(+' + val(e, true) + ' || 0)';
    };

    var wait = function(dur) {
      source += 'save();\n';
      source += 'R.start = self.now();\n';
      source += 'R.duration = ' + dur + ';\n';
      source += 'R.first = true;\n';

      var id = label();
      source += 'if (self.now() - R.start < R.duration * 1000 || R.first) {\n';
      source += '  R.first = false;\n';
      forceQueue(id);
      source += '}\n';
      source += 'console.log(self.now() - R.start);\n';

      source += 'restore();\n';
    };

    var compileBlock = function(block) {
      if (LOG_PRIMITIVES) {
        source += 'console.log(' + val(block[0]) + ');\n';
      }

      if (block[0] === 'doBroadcastAndWait') {

        source += 'save();\n';
        source += 'R.threads = broadcast(' + val(block[1]) + ');\n';
        source += 'if (R.threads.indexOf(BASE) !== -1) return;\n';
        var id = label();
        source += 'if (running(R.threads)) {\n';
        queue(id);
        source += '}\n';
        source += 'restore();\n';

      } else if (block[0] === 'doForever') {

        var id = label();
        seq(block[1]);
        queue(id);

      } else if (block[0] === 'doForeverIf') {

        var id = label();

        source += 'if (' + bool(block[1]) + ') {\n';
        seq(block[2]);
        source += '}\n';

        queue(id);

      // } else if (block[0] === 'doForLoop') {

      } else if (block[0] === 'doIf') {

        source += 'if (' + bool(block[1]) + ') {\n';
        seq(block[2]);
        source += '}\n';

      } else if (block[0] === 'doIfElse') {

        source += 'if (' + bool(block[1]) + ') {\n';
        seq(block[2]);
        source += '} else {\n';
        seq(block[3]);
        source += '}\n';

      } else if (block[0] === 'doRepeat') {

        source += 'save();\n';
        source += 'R.count = ' + num(block[1]) + ';\n';

        var id = label();

        source += 'if (R.count >= 0.5) {\n';
        source += '  R.count -= 1;\n';
        seq(block[2]);
        queue(id);
        source += '} else {\n';
        source += '  restore();\n';
        source += '}\n';

      } else if (block[0] === 'doReturn') {

        source += 'endCall();\n';
        source += 'return;\n';

      } else if (block[0] === 'doUntil') {

        var id = label();
        source += 'if (!' + bool(block[1]) + ') {\n';
        seq(block[2]);
        queue(id);
        source += '}\n';

      } else if (block[0] === 'doWhile') {

        var id = label();
        source += 'if (' + bool(block[1]) + ') {\n';
        seq(block[2]);
        queue(id);
        source += '}\n';

      } else if (block[0] === 'doWaitUntil') {

        var id = label();
        source += 'if (!' + bool(block[1]) + ') {\n';
        queue(id);
        source += '}\n';

      }
    };

    var arg = function(index) {
      return 'C.threads[' + index + '].result';
    };

    var compile = function(name, inputTypes) {
      source += 'save();\n';
      source += 'C.name = ' + JSON.stringify(name) + ";\n";
      source += 'C.threads = [];\n';
      var length = inputTypes.length;
      for (var i=0; i<length; i++) {
        source += 'C.threads[' + i + '] = request(' + i + ');\n';
      }
      for (var i=0; i<length; i++) {
        await('C.threads[' + i + ']');
      }

      switch (name) {
        case 'literal %s':
          emit(arg(0));
          break;
        case '%n + %n':
          emit(arg(0) + ' + ' + arg(1));
          break;
        case 'delay %n secs: %s':
          assert(inputTypes.length === 2);
          wait(arg(0));
          emit(arg(1));
          break;
        case 'get %s':
          source += 'get(' + arg(0) + ');\n';
          source += 'return;\n';
          break;
        case 'display %s':
          emit("['text', 'view-Text', " + arg(0) + "]");
          break;
        default:
          emit('"fred"');
          break;
      }

      source += 'restore();\n';
      var outputType = 'Any';
      return outputType;
    };

    var source = '';
    var startfn = computed.fns.length;
    var fns = [0];

    var outputType = compile(computed.name, computed.args.map((inp, index) => {
      var other = computed.inputs[index]
      return other ? other.type() : "Any";
    }));

    for (var i = 0; i < fns.length; i++) {
      computed.fns.push(createContinuation(source.slice(fns[i])));
    }

    var f = computed.fns[startfn];
    //if (computed.fns.length === 1) debugger;

    return outputType;
  };

  var createContinuation = function(source) {
    var result = '(function() {\n';
    var brackets = 0;
    var delBrackets = 0;
    var shouldDelete = false;
    var here = 0;
    var length = source.length;
    while (here < length) {
      var i = source.indexOf('{', here);
      var j = source.indexOf('}', here);
      if (i === -1 && j === -1) {
        if (!shouldDelete) {
          result += source.slice(here);
        }
        break;
      }
      if (i === -1) i = length;
      if (j === -1) j = length;
      if (shouldDelete) {
        if (i < j) {
          delBrackets++;
          here = i + 1;
        } else {
          delBrackets--;
          if (!delBrackets) {
            shouldDelete = false;
          }
          here = j + 1;
        }
      } else {
        if (i < j) {
          result += source.slice(here, i + 1);
          brackets++;
          here = i + 1;
        } else {
          result += source.slice(here, j);
          here = j + 1;
          if (source.substr(j, 8) === '} else {') {
            if (brackets > 0) {
              result += '} else {';
              here = j + 8;
            } else {
              shouldDelete = true;
              delBrackets = 0;
            }
          } else {
            if (brackets > 0) {
              result += '}';
              brackets--;
            }
          }
        }
      }
    }
    result += '})';
    return runtime.scopedEval(result);
  };

  return function(node) {

    warnings = Object.create(null);

    var type = compileNode(node, []);

    for (var key in warnings) {
      console.warn(key + (warnings[key] > 1 ? ' (repeated ' + warnings[key] + ' times)' : ''));
    }

    return type;
  };

}());
export {compile};

/*****************************************************************************/

export const runtime = (function() {

  var self, S, R, STACK, C, WARP, CALLS, BASE, INDEX, THREAD, IMMEDIATE;

  var bool = function(v) {
    return +v !== 0 && v !== '' && v !== 'false' && v !== false;
  };

  var mod = function(x, y) {
    var r = x % y;
    if (r / y < 0) {
      r += y;
    }
    return r;
  };

  var mathFunc = function(f, x) {
    switch (f) {
      case 'abs':
        return Math.abs(x);
      case 'floor':
        return Math.floor(x);
      case 'sqrt':
        return Math.sqrt(x);
      case 'ceiling':
        return Math.ceil(x);
      case 'cos':
        return Math.cos(x * Math.PI / 180);
      case 'sin':
        return Math.sin(x * Math.PI / 180);
      case 'tan':
        return Math.tan(x * Math.PI / 180);
      case 'asin':
        return Math.asin(x) * 180 / Math.PI;
      case 'acos':
        return Math.acos(x) * 180 / Math.PI;
      case 'atan':
        return Math.atan(x) * 180 / Math.PI;
      case 'ln':
        return Math.log(x);
      case 'log':
        return Math.log(x) / Math.LN10;
      case 'e ^':
        return Math.exp(x);
      case '10 ^':
        return Math.exp(x * Math.LN10);
    }
    return 0;
  };

  // TODO Records
  var jsonToRecords = function(obj) {
    if (typeof obj === 'object') {
      if (obj.constructor === Array) {
        return obj.map(jsonToRecords);
      } else {
        var values = {};
        Object.keys(obj).forEach(key => {
          values[key] = jsonToRecords(obj[key]);
        });
        return new Record(null, values);
      }
    } else {
      return obj;
    }
  };

  var get = function(url) {
    var thread = THREAD;

    // TODO cors proxy
    //var cors = 'http://crossorigin.me/http://';
    var cors = 'http://localhost:1337/';
    url = cors + url.replace(/^https?\:\/\//, "");
    var xhr = new XMLHttpRequest;
    xhr.open('GET', url, true);
    xhr.onprogress = e => {
      // thread.progress(e.loaded, e.total, e.lengthComputable);
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        var r = {
          contentType: xhr.getResponseHeader('content-type'),
          response: xhr.response,
        };

        var mime = r.contentType.split(";")[0];
        var blob = r.response;
        if (/^image\//.test(mime)) {
          var img = new Image();
          img.addEventListener('load', e => {
            thread.emit(img);
          });
          img.src = URL.createObjectURL(blob);
        } else if (mime === 'application/json' || mime === 'text/json') {
          var reader = new FileReader;
          reader.onloadend = () => {
            try {
              var json = JSON.parse(reader.result);
            } catch (e) {
              thread.emit(new Error("Invalid JSON"));
              return;
            }
            thread.emit(jsonToRecords(json));
          };
          reader.onprogress = function(e) {
            //future.progress(e.loaded, e.total, e.lengthComputable);
          };
          reader.readAsText(blob);
        } else if (/^text\//.test(mime)) {
          var reader = new FileReader;
          reader.onloadend = () => {
            thread.emit(reader.result);
          };
          reader.onprogress = function(e) {
            //future.progress(e.loaded, e.total, e.lengthComputable);
          };
          reader.readAsText(blob);
        } else {
          thread.emit(new Error(`Unknown content type: ${mime}`));
        }
      } else {
        thread.emit(new Error('HTTP ' + xhr.status + ': ' + xhr.statusText));
      }
    };
    xhr.onerror = () => {
      thread.emit(new Error('XHR Error'));
    };
    xhr.responseType = 'blob';
    setTimeout(xhr.send.bind(xhr));
  };

  var save = function() {
    STACK.push(R);
    R = {};
  };

  var restore = function() {
    R = STACK.pop();
  };

  // var lastCalls = [];
  var call = function(spec, id, values) {
    // lastCalls.push(spec);
    // if (lastCalls.length > 10000) lastCalls.shift();
    var procedure = S.procedures[spec];
    if (procedure) {
      STACK.push(R);
      CALLS.push(C);
      C = {
        base: procedure.fn,
        fn: S.fns[id],
        args: values,
        numargs: [],
        boolargs: [],
        stack: STACK = [],
        warp: procedure.warp
      };
      R = {};
      if (C.warp || WARP) {
        WARP++;
        IMMEDIATE = procedure.fn;
      } else {
        for (var i = CALLS.length, j = 5; i-- && j--;) {
          if (CALLS[i].base === procedure.fn) {
            var recursive = true;
            break;
          }
        }
        if (recursive) {
          self.queue[INDEX] = {
            parent: S,
            base: BASE,
            fn: procedure.fn,
            calls: CALLS
          };
        } else {
          IMMEDIATE = procedure.fn;
        }
      }
    } else {
      IMMEDIATE = S.fns[id];
    }
  };

  var endCall = function() {
    if (CALLS.length) {
      if (WARP) WARP--;
      IMMEDIATE = C.fn;
      C = CALLS.pop();
      STACK = C.stack;
      R = STACK.pop();
    }
  };

  var queue = function(id) {
    IMMEDIATE = THREAD.fns[id];
    assert(THREAD.fns.indexOf(IMMEDIATE) !== -1);
    // TODO warp??
  };

  var forceQueue = function(id) {
    self.queue[INDEX] = THREAD;
    THREAD.fn = THREAD.fns[id];

    // assert(THREAD.parent === S);
    // assert(THREAD.fns === S.fns);
    assert(THREAD.fns.indexOf(THREAD.fn) !== -1);
  };

  var request = function(index) {
    var computed = THREAD.inputs[index];
    THREAD.deps.add(computed);
    if (computed.isComputed) {
      return computed.request();
    } else {
      return computed;
    }
  };

  var await = function(thread, id) {
    if (thread instanceof Observable) return;
    var wake = THREAD;
    if (!thread.isDone) {
      thread.onFirstEmit(function(result) {
        awake(wake, id);
      });
      return true;
    }
  };

  var awake = function(thread, id) {
    self.queue.push(thread);
    thread.fn = thread.parent.fns[id];
  }

  var emit = function(result) {
    THREAD.emit(result);
  };

  /***************************************************************************/

  // Internal definition
  class Evaluator {
    constructor() {
      this.queue = [];
      this.baseNow = 0;
    }

    get framerate() { return 60; }

    initRuntime() {
      this.queue = [];
      this.onError = this.onError.bind(this);
    }

    startThread(thread) {
      var index = this.queue.indexOf(thread);
      if (index !== -1) {
        this.queue[index] = undefined;
      }
      this.queue.push(thread);
    }

    stopThread(thread) {
      var index = this.queue.indexOf(thread);
      if (index !== -1) {
        this.queue[index] = undefined;
      }
    }

    start() {
      this.isRunning = true;
      if (this.interval) return;
      addEventListener('error', this.onError);
      this.baseTime = Date.now();
      this.interval = setInterval(this.step.bind(this), 1000 / this.framerate);
    }

    pause() {
      if (this.interval) {
        this.baseNow = this.now();
        clearInterval(this.interval);
        delete this.interval;
        removeEventListener('error', this.onError);
      }
      this.isRunning = false;
    }

    stopAll() {
      this.hidePrompt = false;
      this.prompter.style.display = 'none';
      this.promptId = this.nextPromptId = 0;
      this.queue.length = 0;
      this.resetFilters();
      this.stopSounds();
      for (var i = 0; i < this.children.length; i++) {
        var c = this.children[i];
        if (c.isClone) {
          c.remove();
          this.children.splice(i, 1);
          i -= 1;
        } else if (c.isSprite) {
          c.resetFilters();
          if (c.saying) c.say('');
          c.stopSounds();
        }
      }
    }

    now() {
      return this.baseNow + Date.now() - this.baseTime;
    }

    step() {
      self = this;
      var start = Date.now();
      do {
        var queue = this.queue;
        for (INDEX = 0; INDEX < queue.length; INDEX++) {
          THREAD = queue[INDEX];
          if (THREAD) {
            S = THREAD.parent;
            IMMEDIATE = THREAD.fn;
            BASE = THREAD.base;
            CALLS = THREAD.calls;
            C = CALLS.pop();
            STACK = C.stack;
            R = STACK.pop();
            queue[INDEX] = undefined;
            WARP = 0;
            while (IMMEDIATE) {
              var fn = IMMEDIATE;
              assert(THREAD.fns.indexOf(fn) !== -1);
              IMMEDIATE = null;
              fn();
            }
            STACK.push(R);
            CALLS.push(C);
          }
        }
        for (var i = queue.length; i--;) {
          if (!queue[i]) queue.splice(i, 1);
        }
      } while (Date.now() - start < 1000 / this.framerate && queue.length);
      S = null;
    }

    onError(e) {
      clearInterval(this.interval);
    }

    handleError(e) {
      console.error(e.stack);
    }
  }
  var evaluator = new Evaluator();
  evaluator.start();

  class Graph {
    constructor(nodes, links) {
      this.nodes = {};
    }

    add(node, id) {
      if (this.nodes.hasOwnProperty(id)) throw "oops";
      this.nodes[id] = node;
      node.id = id;
    }

    get(nodeId) {
      return this.nodes[nodeId];
    }

    linkFromJSON(json) {
      return {from: this.get(json.from), index: json.index, to: this.get(json.to)};
    }

    onMessage(json) {
      switch (json.action) {
        case 'link':
          var link = this.linkFromJSON(json);
          link.to.replace(link.index, link.from);
          return;
        case 'unlink':
          var link = this.linkFromJSON(json);
          link.to.replace(link.index);
          return;
        case 'setLiteral':
          var node = this.get(json.id);
          node.assign(json.literal);
          return;
        case 'setSink':
          var node = this.get(json.id);
          node.isSink = json.isSink;
          return;
        case 'create':
          var node = json.hasOwnProperty('literal') ? new Observable(json.literal) : new Computed(json.name);
          this.add(node, json.id);
          return;
        case 'destroy':
          var node = this.get(json.id);
          this.remove(node);
          node.destroy();
          return;
        default:
          throw json;
      }
    }

    sendMessage(json) {}

    invalidate(node) {
      var action = 'invalidate';
      var id = node.id;
      var json = {action, id};
      this.sendMessage(json);
    }

    emit(node, value) {
      var action = 'emit';
      var id = node.id;
      var json = {action, id, value};
      this.sendMessage(json);
    }

    progress(node, loaded, total) {
      var action = 'progress';
      var id = node.id;
      var json = {action, id, loaded, total};
      this.sendMessage(json);
    }
  }
  var graph = new Graph();

  /***************************************************************************/

  class Observable {
    constructor(value) {
      this.result = value;
      this.subscribers = new Set();
    }

    subscribe(obj) {
      this.subscribers.add(obj);
    }

    unsubscribe(obj) {
      this.subscribers.delete(obj);
    }

    assign(value) {
      this.result = value;
      this.invalidate();
      this.emit(value);
    }

    invalidate() {
      this.subscribers.forEach(s => s.invalidate(this));
    }

    emit() {
      this.subscribers.forEach(s => s.update(this));
    }

    update() {}

    type() {
      return typeOf(this.result);
    }
  }

  class Computed extends Observable {
    constructor(name, inputs) {
      super(null);
      this.name = name;
      this.args = name.split(" ").filter(x => x[0] === '%');

      inputs = inputs || [];
      this.inputs = inputs;
      this.deps = new Set(inputs.filter((arg, index) => (this.args[index] !== '%u')));
      this.fns = [];
      this.thread = null;
    }
    get isComputed() { return true; }

    invalidate(arg) {
      //assert(this.deps.has(arg));
      if (this.thread === null) {
        return;
      }
      // if (this.thread) {
      //   this.thread.cancel();
      // }
      this.thread = null;
      graph.invalidate(this);
      super.invalidate();
    }

    update(arg) {
      assert(this.deps.has(arg));
      if (this.thread && this.thread.hasStarted && this.thread.deps.has(arg)) {
        this.thread.cancel();
      }
      if (this.needed) {
        this.recompute();
      }
    }

    type() {
      if (this._type) {
        return this._type;
      }
      this.fns = [];
      this._type = compile(this);
      assert(this._type);
      return this._type;
    }

    recompute() {
      console.log('recompute', this.name);
      this.type();
      var thread = this.thread = new Thread(evaluator, this, this.fns[0]);
      thread.onFirstEmit(result => {
        this.result = result;
        graph.emit(this, result);
        this.emit(result);

        this.deps.forEach(dep => dep.unsubscribe(this));
        this.deps = thread.deps;
        this.deps.forEach(dep => dep.subscribe(this));
      });
    }

    replace(index, arg) {
      var old = this.inputs[index];
      if (arg === undefined) {
        delete this.inputs[index];
      } else {
        this.inputs[index] = arg;
      }
      if (old) {
        old.unsubscribe(this);
        if (this.deps.has(old)) {
          this.deps.delete(arg);
        }
      }
      this.invalidate();
      this._type = null;
      if (this.needed) {
        this.recompute();
      }
    }

    get needed() {
      return this.name === 'display %s' || this.subscribers.size;
    }

    subscribe(obj) {
      super.subscribe(obj);
    }

    request() {
      if (!this.thread) {
        this.recompute();
      }
      return this.thread;
    }
  }

  /*****************************************************************************/

  class Thread {
    constructor(evaluator, parent, base) {
      this.evaluator = evaluator;
      this.parent = parent,
      this.base = base;
      this.fn = base;
      this.calls = [{args: [], stack: [{}]}];
      assert(base);

      this.fns = parent.fns;
      this.inputs = parent.inputs;

      this.hasStarted = false;
      this.isDone = false;
      this.canceled = false;
      this.deps = new Set();
      this.evaluator.startThread(this);

      this.result = null;
      this.children = [];
      // TODO composite progress
    }

    cancel() {
      this.evaluator.stopThread(this);
      this.canceled = true;
    }

    emit(result) {
      this.result = result;
      if (!this.isDone) {
        this.isDone = true;
        this.dispatchFirstEmit(result);
      }
      this.dispatchEmit(result);
    }
  }
  addEvents(Thread, 'firstEmit', 'emit', 'progress');

  /***************************************************************************/

  return {
    scopedEval: function(source) {
      return eval(source);
    },
    evaluator: evaluator,
    graph: graph,
  };


}());

export const evaluator = runtime.graph;
