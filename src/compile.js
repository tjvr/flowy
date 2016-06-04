import {addEvents} from "./events";

import {bySpec, coercionsByType, literal} from "./prims";
import {byName} from "./prims"; // TODO

function assert(x) {
  if (!x) throw "Assertion failed!";
}


export const type = (function() {
  'use strict';

  var coercions = new Map();
  Object.keys(coercionsByType).forEach(out => {
    var map;
    coercions.set(out, map = new Map());
    coercionsByType[out].forEach(p => {
      let [input, coercion] = p;
      map.set(input, coercion);
    });
  });


  class Result {
    constructor(kind, result) {
      this.kind = kind;
      this.result = result;
    }

    static list(child) {
      var kind = 'list';
      return {kind, child};
    }

    static record(schema) {
      var kind = 'record';
      return {kind, schema};
    }

    static vectorise(child) {
      var kind = 'vectorise';
      return child === true ? {kind} : {kind, child};
    }

    static coerce(from, to)  {
      var map = coercions.get(to);
      if (map) {
        var coercion = map.get(from);
        if (coercion) {
          var kind = 'coerce';
          return {kind, from, to, coercion};
        }
      }
    }

    static resolve(child)  {
      var kind = 'resolve';
      return child === true ? {kind} : {kind, child};
    }

    static typeCheck(type) {
      var kind = 'check';
      return {kind, type};
    }
  }

  class Type {
    static fromString(name) {
      assert(!(name instanceof Type));
      if (/ Future$/.test(name)) {
        return new FutureType(Type.fromString(name.replace(/ Future$/, "")));
        return Type.fromString(name.replace(/ Future$/, ""));
      }
      if (/ List$/.test(name)) {
        return new ListType(Type.fromString(name.replace(/ List$/, "")));
      }
      assert(!/ /.test(name));
      switch (name) {
        case 'Any':
          return new AnyType();
        case 'Future':
          return new FutureType();
        case 'List':
          return new ListType();
        case 'Record':
          return new RecordType();
        case 'Date':
        case 'Time':
          return new RecordType(name, {}); // TODO
        default:
          return new ValueType(name);
      }
    }

    isSuper(other) {
      if (other instanceof AnyType) {
        return Result.typeCheck(this);
      }
      if (other instanceof ListType && (t = this.isSuper(other.child))) {
        return Result.vectorise(t);
      }
      var t;
      if (t = Result.coerce(other, this)) {
        return t;
      }
      return false;
    }
  }

  class ValueType extends Type {
    constructor(name) {
      super();
      assert(!/ /.test(name));
      this.name = name;
    }
    toString() { return this.name.toString(); }

    isSuper(other) {
      if (other instanceof ValueType && this.name === other.name) {
        return true;
      }
      return super.isSuper(other);
    }
  }

  class FutureType extends Type {
    constructor(child) {
      super();
      this.child = child || new AnyType();
    }
    toString() { return "Future " + this.child.toString(); }
    get isFuture() { return true; }

    isSuper(other) {
      var t;
      if (other instanceof FutureType && (t = this.isSuper(other.child))) {
        return t;
      }
      if (t = this.child.isSuper(other)) {
        return Result.resolve(t);
      }
      return super.isSuper(other);
    }
  }

  class ListType extends Type {
    constructor(child) {
      super();
      this.child = child || new AnyType();
    }
    toString() { return "List of " + this.child.toString(); }

    isSuper(other) {
      var t;
      if (other instanceof ListType && (t = this.child.isSuper(other.child))) {
        return t === true ? true : Result.list(t);
      }
      return super.isSuper(other);
    }
  }

  class RecordType extends Type {
    constructor(name, schema) {
      super();
      this.name = name;
      this.schema = schema || {};
    }

    keys() {
      return Object.keys(this.schema);
    }

    toString() {
      if (this.name) return this.name;
      var r = this.keys().map(symbol => {
        return symbol + "→ " + this.schema[symbol].toString();
      }).join(", ");
      return "Record {" + r + "}";
    }

    isSuper(other) {
      if (other instanceof RecordType) {
        // TODO named records / user-defined types
        // if (other.name) {
        //   if (this.name === other.name) {
        //     return true;
        //   }
        // }

        var ts;
        var schema = this.schema;
        var otherSchema = other.schema;
        var symbols = other.keys();
        var length = symbols.length;
        for (var i=0; i<length; i++) {
          var sym = symbols[i];
          var theirs = otherSchema[sym];
          if (!theirs) {
            return super.isSuper(other);
          }
          var ours = schema[sym];
          var t = ours.isSuper(theirs);
          if (!t) {
            return super.isSuper(other);
          }
          if (t !== true) {
            ts = ts || {};
            ts[sym] = t;
          }
        }
        return ts ? Result.record(ts) : true;
      }
      return super.isSuper(other);
    }
  }

  class AnyType extends Type {
    toString() { return "Any"; }

    isSuper(other) {
      return true;
    }
  }


  var prims = {};
  Object.keys(bySpec).forEach(name => {
    var imps = bySpec[name];
    prims[name] = [];
    imps.forEach(p => {
      let {inputs, output, func} = p;
      var inputTypes = inputs.map(Type.fromString);
      var outputType = Type.fromString(output);
      prims[name].push({
        wants: inputTypes,
        output: outputType,
        func: func,
      });
    });
  });

  function isValid(result) {
    if (result.kind === 'vectorise') {
      if (!result.child) return true;
      return !containsVectorise(result.child);
    } else {
      return !containsVectorise(result);
    }
  }

  function containsVectorise(result) {
    switch (result.kind) {
      case 'vectorise':
        return true;
      case 'list':
      //case 'resolve':
        return containsVectorise(result.child);
      case 'record':
        for (var key in result.schema) {
          if (containsVectorise(result.schema[key])) return true;
        }
        return false;
      case 'check':
      case 'coerce':
        return false;
    }
  }

  var typeSpecial = function(name, inputTypes) {
    switch (name) {
      case 'item %n of %l':
        let [index, list] = inputTypes;
        return list.child;

      case 'list %exp':
        // TODO argh
        return type.list(inputTypes[0]);

      // case '%q of %o':
      //   let [symbol, record] = inputTypes;
      //   assert(type.symbol.isSuper(symbol)); // and is immediate!
      //   var value = TODO get actual symbol value
      //   return record.schema[value];

      // TODO concat...
      // TODO record type
      // TODO list type
    }
  };

  var type = function(name, inputTypes) {
    var imps = prims[name];
    if (!imps) return {};
    var length = imps.length;

    for (var i=0; i<inputTypes.length; i++) {
      if (inputTypes[i] === null) return {};
    }

    var bestScore = Infinity;
    var best = [];
    for (var i=0; i<length; i++) {
      var imp = imps[i];
      var wants = imp.wants;
      var results = [];
      var score = 0;
      for (var j=0; j<wants.length; j++) {
        var result = wants[j].isSuper(inputTypes[j]);
        if (!result || !isValid(result)) break;
        if (result !== true) {
          score++;
        }
        results.push(result);
      }
      if (j < wants.length) continue;

      if (score < bestScore) {
        best = [];
        bestScore = score;
      }
      if (score === bestScore) {
        best.push({imp, results});
      }
    }

    var out = typeSpecial(name, inputTypes);
    return {best, out};
  };

  var cache = function(cls) {
    var cache = new Map();
    return function(key) {
      if (!cache.has(key)) {
        cache.set(key, new cls(key));
      }
      return cache.get(key);
    };
  };
  type.value = cache(ValueType);
  type.list = cache(ListType);
  type.future = cache(FutureType);
  type.record = function(schema) {
    return new RecordType(null, schema);
  };
  type.symbol = type.value('Symbol');
  type.none = new ValueType('None');
  type.any = new AnyType(null);

  return type;

}());



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

    var body = function(func, length) {
      source += 'var result;\n';
      if (typeof func === 'function') return; // TODO
      if (typeof func === 'object') return; // TODO

      if (func[0] === '(') {
        func = func.replace(/\$[0-9]+/g, function(x) { return arg(x.substr(1)); });
        source += 'result = ' + func + ';\n';
        source += 'emit(result);\n';
        return;
      }

      var args = [];
      for (var i=0; i<length; i++) {
        args.push(arg(i));
      }
      source += 'result = ' + func + '(' + args.join(', ') + ');\n';
    };

    var party = function(func, length) {
      // apply coercions
      // resolve Futures
      // evaluate inputs

      switch (func) {
        case 'delay %n secs: %s':
          assert(inputTypes.length === 2);
          wait(arg(0));
          emit(arg(1));
          break;

        default:
          body(func, length);
      }
    };

    var recurse = function(func, out, results) {
      // vectorise
      var vectorise = [];
      for (var i=0; i<results.length; i++) {
        if (results[i] !== true && results[i].kind === 'vectorise') vectorise.push(i);
      }
      if (vectorise.length) {
        results = results.map(result => {
          return result !== true && result.kind === 'vectorise' ? result.child || true : result;
        });
        // TODO fast vectorise if prim is immediate
        // TODO parallel map
        source += 'save();\n';
        source += 'R.length = ' + arg(vectorise[0]) + '.length;\n';
        if (vectorise.length > 1) {
          var cond = [];
          for (var i=1; i<vectorise.length; i++) {
            cond.push(arg(vectorise[i]) + '.length !== R.length');
          }
          source += 'if (' + cond.join(' || ') + ') {\n';
            emit('new Error("Poop")');
            source += '}\n';
        }
        source += 'if (R.length === 0) {\n';
        emit('[]');
        source += 'return;\n';
        source += '}\n';
        source += 'R.index = 0;\n';
        source += 'R.results = [];\n';
        source += 'R.arrays = C.threads;\n';
        source += 'C.threads = R.arrays.slice();\n';
        var id = label();
        for (var i=0; i<vectorise.length; i++) {
          source += 'C.threads[' + vectorise[i] + '] = {result: R.arrays[' + vectorise[i] + '].result[R.index]};\n';
        }
        party(func, results.length);
        source += 'R.results.push(result);\n';
        source += 'R.index += 1;\n';
        source += 'if (R.index < R.length) {\n';
        queue(id);
        source += '}\n';
        source += 'emit(R.results);\n';
        source += 'restore();\n';
        return type.list(out);
      }

      party(func, results.length);
      if (func === 'get') return;

      if (out.isFuture) {
        out = out.child;
        source += 'save();\n';
        source += 'R.thread = result;\n';
        await('result');
        source += 'result = R.thread.result;\n';
        source += 'restore();\n';
      }
      emit('result');
      return out;
    };

    var compile = function(name, inputTypes) {
      if (name === '%s') return type.value("Ring"); // TODO rings
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
        case 'display %s':
          source += 'if (' + arg(0) + ' === null) {\n';
          emit('null');
          source += 'return;\n'
          source += '}\n';
          break;

        case 'list %exp':
          source += 'var list = [];\n';
          for (var i=0; i<length; i++) {
            source += 'list.push(' + arg(i) + ');\n';
          }
          source += 'emit(list);\n';
          return new type.list(inputTypes[0]);
      }

      var {best, out} = type(name, inputTypes);
      var imps = best;
      if (!imps || !imps.length) {
        console.log('no imps for', name, inputTypes);
        return null;
      }

      // look for typechecks.
      if (imps.length !== 1) {
        console.log('multiple imps for', name, inputTypes);
        return null;
      }
      var best = imps[0];
      var imp = best.imp;
      out = out || imp.output;

      console.log('got imp for', name, '->', out);

      out = recurse(imp.func, out, best.results);

      source += 'restore();\n';
      return out;
    };

    var source = '';
    var startfn = computed.fns.length;
    var fns = [0];

    var inputTypes = [];
    computed.args.forEach((spec, index) => {
      switch (spec) {
        case '%fields':
          // TODO
          break;
        case '%exp':
          for (var i=index; i<computed.inputs.length; i++) {
            var other = computed.inputs[i];
            other = other ? other.type() : null;
            inputTypes.push(other);
          }
          // TODO
          break;
        case '%br': break;
        case '%%': break;
        default:
          var other = computed.inputs[index];
          other = other ? other.type() : null;
          inputTypes.push(other);
      }
    });
    var outputType = compile(computed.name, inputTypes);

    for (var i = 0; i < fns.length; i++) {
      computed.fns.push(createContinuation(source.slice(fns[i])));
    }

    var f = computed.fns[startfn];

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

import jsBigInteger from "js-big-integer";
import _fraction from "fraction.js";
import _tinycolor from  "tinycolor2";

export const runtime = (function() {

  var BigInteger = jsBigInteger.BigInteger;

  class Record {
    constructor(type, values) {
      //this.type = type || type.record(values);
      this.values = values;
    }

    update(newValues) {
      var values = {};
      this.type.keys().forEach(name => {
        values[name] = this.values[name];
      });
      Object.keys(newValues).forEach(name => {
        values[name] = newValues[name];
      });
      // TODO maintain order
      //return new Record(type.record(values), values);
    }

    toJSON() {
      return this.values;
    }
  }

  var Fraction = _fraction;
  var tinycolor = _tinycolor;

  class Uncertain {
    constructor(mean, stddev) {
      this.m = +mean;
      this.s = +stddev || 0;
    }

    static add(a, b) {
      return new Uncertain(a.m + b.m, Math.sqrt(a.s * a.s + b.s * b.s));
    }

    static mul(x, y) {
      var a = y.m * x.s;
      var b = x.m * y.s;
      return new Uncertain(x.m * y.m, Math.sqrt(a * a + b * b)); // TODO
    }
  }


  var typeOf = function(value) {
    if (value === undefined) return '';
    if (value === null) return '';
    switch (typeof value) {
      case 'number':
        if (/^-?[0-9]+$/.test(''+value)) return type.value('Int');
        return 'Float';
      case 'string':
        if (value === '') return type.value('Empty');
        return type.value('Text');
      case 'boolean':
        return type.value('Bool');
      case 'object':
        // if (value.isObservable) return type.value('Uneval'); // TODO
        if (value instanceof Thread) {
          return type.future(value.outputType);
        }
        switch (value.constructor) {
          case Error: return type.value('Error');
          case BigInteger: return type.value('Int');
          case Array: return type.value('List');
          case Image: return type.value('Image');
          case Uncertain: return type.value('Uncertain');
          // case Record: return value.schema ? value.schema.name : 'Record'; // TODO
        }
        if (value instanceof Fraction) return type.value('Frac'); // TODO
        if (value instanceof tinycolor) return type.value('Color'); // TODO
    }
    throw "Unknown type: " + value;
  };



  var self, S, R, STACK, C, WARP, CALLS, BASE, INDEX, THREAD, IMMEDIATE;

  var display = function(type, content) {
    return ['text', 'view-' + type, content || ''];
  };

  function withValue(value, cb) {
    if (value instanceof Thread) {
      if (value.isDone) {
        cb(value.result);
      } else {
        value.onFirstEmit(cb);
      }
    } else {
      cb(value);
    }
  }

  var displayFloat = function(x) {
    var r = ''+x;
    var index = r.indexOf('.');
    if (index === -1) {
      r += '.';
    } else if (index !== -1 && !/e/.test(r)) {
      if (r.length - index > 3) {
        r = x.toFixed(3);
      }
    }
    return display('Float', r);
  };

  var displayRecord = function(record) {
    // TODO use RecordView
    var schema = record.schema;
    var symbols = schema ? schema.symbols : Object.keys(record.values);
    var items = [];
    var r = ['table', items];
    if (schema) {
      r = ['block', [
        ['text', 'record-title', schema.name, 'auto'],
        r,
      ]];
    }

    symbols.forEach((symbol, index) => {
      var cell = ['cell', 'field', ['text', 'ellipsis', ". . ."]];
      var field = ['row', 'field', index, [
        ['text', 'field-name', symbol],
        ['text', 'field-sym', "→"],
        cell,
      ]];
      items.push(field);

      withValue(record.values[symbol], result => {
        var prim = this.evaluator.getPrim("display %s", [result]);
        var value = prim.func.call(this, result);
        cell[2] = value;
        this.emit(r);
      });
    });
    this.emit(r);
    return r;
  };

  var displayList = function(list) {
    var items = [];
    var l = ['table', items];

    var ellipsis = ['text', 'ellipsis', ". . ."];

    if (list.length === 0) {
      // TODO empty lists
      this.emit(l);
      return l;
    }

    withValue(list[0], first => {
      var isRecordTable = false;
      if (first instanceof Record) {
        var schema = first.schema;
        var symbols = schema ? schema.symbols : Object.keys(first.values);
        var headings = symbols.map(text => ['cell', 'header', ['text', 'heading', text], text]);
        items.push(['row', 'header', null, headings]);
        isRecordTable = true;
      }

      // TODO header row for list lists

      list.forEach((item, index) => {
        var type = typeOf(item);
        if (isRecordTable && /Record/.test(type)) {
          items.push(['row', 'record', index, [ellipsis]]);
          withValue(item, result => {
            var values = symbols.map(sym => {
              var value = result.values[sym];
              var prim = this.evaluator.getPrim("display %s", [value]);
              return ['cell', 'record', prim.func.call(this, value), sym];
            });
            items[index + 1] = ['row', 'record', index, values];
            this.emit(l);
          });

        } else if (/List$/.test(type)) {
          items.push(['row', 'list', index, [ellipsis]]);
          withValue(item, result => {
            var values = result.map((item2, index2) => {
              var prim = this.evaluator.getPrim("display %s", [item2]);
              return ['cell', 'list', prim.func.call(this, item2), index2 + 1];
            });
            items[index] = ['row', 'list', index, values];
          });

        } else {
          items.push(['row', 'item', index, [ellipsis]]);
          withValue(item, result => {
            var prim = this.evaluator.getPrim("display %s", [result]);
            var value = ['cell', 'item', prim.func.call(this, result)];
            items[isRecordTable ? index + 1 : index] = ['row', 'item', index, [value]];
          });
        }
      });
    });
    this.emit(l);
    return l;
  };

  var displayList = function(list) {
    if (!list) return;
    return ['block', list.map(x => ['text', 'Text', x])];
  };

  var mod = function(x, y) {
    var r = x % y;
    if (r / y < 0) {
      r += y;
    }
    return r;
  };

  var range = function(from, to) {
    var result = [];
    for (var i=from; i<=to; i++) {
      result.push(i);
    }
    return result;
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

  var saveCall = function() {
    CALLS.push(C);
    C = {};
  };

  var restoreCall = function() {
    C = CALLS.pop();
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
      var thread = computed.request();
      assert(computed._type !== null);
      return thread;
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
        if (!arg.isComputed || arg._type === null) {
          this._type = null;
        }
        this.recompute();
      }
    }

    type() {
      // if (this._type) {
      //   return this._type;
      // }
      this.fns = [];
      this._type = compile(this);
      return this._type;
    }

    recompute() {
      console.log('recompute', this.name);
      this.type();
      if (!this._type) {
        this.setDeps(new Set(this.inputs.filter((arg, index) => (this.args[index] !== '%u'))));
        if (this.result !== null) {
          this.result = null;
          this.emit(null);
        }
      } else {
        var thread = this.thread = new Thread(evaluator, this, this.fns[0]);
        thread.onFirstEmit(result => {
          this.result = result;
          if (this.name === 'display %s') {
            graph.emit(this, result);
          }
          this.emit(result);

          this.setDeps(thread.deps);
        });
      }
    }

    setDeps(deps) {
      var oldDeps = this.deps;
      this.deps = deps;

      oldDeps.forEach(d => {
        if (!deps.has(d)) d.unsubscribe(this);
      });
      deps.forEach(d => {
        if (!oldDeps.has(d)) d.subscribe(this);
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
      this.outputType = parent._type;

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

