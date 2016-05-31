var compile = (function() {
  'use strict';

  var LOG_PRIMITIVES;
  var DEBUG;
  LOG_PRIMITIVES = true;
  DEBUG = true;

  var warnings;
  var warn = function(message) {
    warnings[message] = (warnings[message] || 0) + 1;
  };

  var compileNode = function(object, script) {
    //if (!script[0] || EVENT_SELECTORS.indexOf(script[0][0]) === -1) return;

    var nextLabel = function() {
      return object.fns.length + fns.length;
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

    var request = function(node) {
      var id = label();
      var tmp = genSym();
      if (node.isObservable) {
        source += `${tmp} = ${node}.value\n`;
        return tmp;
      }
      if (node.thread) {
        if (node.thread.isDone) {
          source += `${tmp} = ${node}.thread.result\n`;
          return tmp;
        }
      } else {
        node.request();
      }
      node.thread.onFirstEmit(this.awake);
      return tmp;
      // source += 'request(' + node + ')';
    };

    var seq = function(script) {
      if (!script) return;
      for (var i = 0; i < script.length; i++) {
        compile(script[i]);
      }
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
      queue(id);
      source += '}\n';

      source += 'restore();\n';
    };

    var compile = function(block) {
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

    var source = '';
    var startfn = object.fns.length;
    var fns = [0];

    for (var i = 1; i < script.length; i++) {
      compile(script[i]);
    }

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


    source += 'if (true) {\n';
    var id = label();
    source += 'lol();'
    source += '} else {\n';
    queue(id);
    source += '}\n';

    for (var i = 0; i < fns.length; i++) {
      object.fns.push(createContinuation(source.slice(fns[i])));
    }

    var f = object.fns[startfn];
  };


  return function(node) {

    warnings = Object.create(null);

    compileNode(node, []);

    for (var key in warnings) {
      console.warn(key + (warnings[key] > 1 ? ' (repeated ' + warnings[key] + ' times)' : ''));
    }

  };

}());
export {compile};

/*****************************************************************************/

var runtime = (function() {

  var self, S, R, STACK, C, WARP, CALLS, BASE, THREAD, IMMEDIATE;

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
          self.queue[THREAD] = {
            sprite: S,
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
    self.queue[THREAD] = {
      sprite: S,
      base: BASE,
      fn: S.fns[id],
      calls: CALLS
    };
  };

  /***************************************************************************/

  // Internal definition
  class Evaluator {
    get framerate() { return 60; }

    initRuntime() {
      this.queue = [];
      this.onError = this.onError.bind(this);
    }

    startThread(sprite, base) {
      var thread = new Thread(sprite, base);
      for (var i = 0; i < this.queue.length; i++) {
        var q = this.queue[i];
        if (q && q.sprite === sprite && q.base === base) {
          this.queue[i] = thread;
          return;
        }
      }
      this.queue.push(thread);
    }

    stopThread(thread) {
      var index = this.queue.indexOf(thread);
      if (index !== -1) {
        this.queue.splice(index, 1);
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
        for (THREAD = 0; THREAD < queue.length; THREAD++) {
          if (queue[THREAD]) {
            S = queue[THREAD].sprite;
            IMMEDIATE = queue[THREAD].fn;
            BASE = queue[THREAD].base;
            CALLS = queue[THREAD].calls;
            C = CALLS.pop();
            STACK = C.stack;
            R = STACK.pop();
            queue[THREAD] = undefined;
            WARP = 0;
            while (IMMEDIATE) {
              var fn = IMMEDIATE;
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
      this.syncEmissions();
      S = null;
    }

    syncEmissions() {
      // TODO process emit queue
    }

    onError(e) {
      clearInterval(this.interval);
    }

    handleError(e) {
      console.error(e.stack);
    }

  }

  /***************************************************************************/

  class Thread {
    constructor(evaluator, sprite, base) {
      this.evaluator = evaluator;
      this.sprite = sprite,
      this.base = base;
      this.fn = base;
      this.calls = [{args: [], stack: [{}]}];
      this.isRunning = true;
    }

    stop() {
      this.evaluator.stopThread(this);
      this.isRunning = false;
    }

  }

  /***************************************************************************/

  return {
    scopedEval: function(source) {
      return eval(source);
    }
  };


}());


