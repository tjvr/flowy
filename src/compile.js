
import type from "./type";
import {scopedEval} from "./runtime";

function assert(x) {
  if (!x) throw "Assertion failed!";
}

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
      case 'delay':
        assert(length === 2);
        wait(arg(0));
        emit(arg(1));
        break;

      case 'get':
        source += 'save();\n';
        await('R.future = getURL(' + arg(0) + ')');
        await('R.future = readFile(R.future.result)');
        source += 'emit(R.future.result);\n';
        source += 'restore();\n';
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
    if (func === 'get' || func === 'delay') return type.any;

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

      default:
    }
  };

  var specialise = function(name, inputTypes) {
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

    var imps = type(name, inputTypes);
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
    var out = imp.output;

    console.log('got imp for', name, '->', out);

    out = recurse(imp.func, out, best.results);


    source += 'restore();\n';
    console.log(source);
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
  var outputType = specialise(computed.name, inputTypes);

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
  return scopedEval(result);
};

export default function(node) {

  warnings = Object.create(null);

  var type = compileNode(node, []);

  for (var key in warnings) {
    console.warn(key + (warnings[key] > 1 ? ' (repeated ' + warnings[key] + ' times)' : ''));
  }

  return type;
};

