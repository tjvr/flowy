
function assert(x) {
  if (!x) throw "Assertion failed!";
}

function isArray(x) {
  return x && x instanceof Array;
}

function all(seq, cb) {
  for (var i=0; i<seq.length; i++) {
    if (!cb(seq[i])) return false;
  }
  return true;
}

function any(seq, cb) {
  for (var i=0; i<seq.length; i++) {
    if (cb(seq[i])) return true;
  }
  return false;
}


/*****************************************************************************/

import type from "./type";
import {scopedEval} from "./runtime";

var customBlocks = {};

class Func {
  constructor() {
    this.fns = [];
  }

  static cache(name) {
    var cache = Func._cache;
    if (!cache.has(name)) {
      cache.set(name, new Func());
    }
    return cache.get(name);
  }
}
Func._cache = new Map();

/*****************************************************************************/

class Gen {
  constructor(name, canYield) {
    this.name = name;
    this.canYield = !!canYield;
  }
}

class Vectorise extends Gen {
  constructor(child, indexes) {
    super('vectorise', child.canYield);
    this.child = child;
    this.indexes = indexes;
  }
}

// for prims
class Apply extends Gen {
  constructor(func, args) {
    super('apply', func.canYield || any(args, g => g.canYield));
    assert(!(func instanceof Function));
    this.func = func;
    this.args = args;
  }

  sub(index, arg) {
    this.args[index] = arg;
    this.canYield = this.func.canYield || any(this.args, g => g.canYield);
  }
}

// for custom
class Call extends Gen {
  constructor(spec, startfn, args) {
    super('call', customBlocks[spec].canYield || any(args, g => g.canYield));
    this.spec = spec;
    this.startfn = startfn;
    this.args = args;
  }

  sub(index, arg) {
    this.args[index] = arg;
    this.canYield = customBlocks[this.spec].canYield || any(this.args, g => g.canYield);
  }
}

class Literal extends Gen {
  constructor(value) {
    super('literal', false);
    this.value = value;
  }
}

class Arg extends Gen {
  constructor(index) {
    super('arg', false);
    this.index = index;
  }
}

class Resolve extends Gen {
  constructor(child) {
    super('resolve', true);
    this.child = child;
  }
}

class Coerce extends Gen {
  constructor(child, source) {
    super('coerce', child.canYield);
    this.child = child;
    this.source = source;
  }
}

class RuntimeCheck extends Gen {
  constructor(name) {
    super('runtime-typing', true);
    this.name = name;
  }
}

/*****************************************************************************/

var coerce = function(child, argType, coercion) {
  if (coercion === true) {
    // TODO check child has type?
    return child;
  }
  switch (coercion.kind) {
    case 'list':
      assert(argType.isList);

      assert(coercion.child.kind === 'coerce'); // TODO
      var source = coercion.child.coercion;
      source = '($0.map(function(x) { return ' + subst(source, ['x']) + '}))';

      var g = coerce(child, argType.child, true);
      return new Coerce(g, source);

    case 'record':
      // TODO
      assert(false);
      return;

    case 'resolve':
      assert(argType.isFuture);
      var g = coerce(child, argType.child);
      return new Resolve(child);

    case 'coerce':
      assert(coercion.from.isSuper(argType));
      var g = coerce(child, coercion.to, true);
      return new Coerce(g, coercion.coercion);

    case 'check':
      assert(false);
  }

};

var apply = function(func, inputTypes, coercions) {
  var args = [];
  for (var i=0; i<inputTypes.length; i++) {
    var arg = new Arg(i);
    if (func.wants[i].isUneval) {
      arg.uneval = true;
    }
    args.push(coerce(arg, inputTypes[i], coercions[i]));
  }
  //assert(all(coercions, c => c === true));
  for (var i=0; i<func.wants.length; i++) {
    assert(func.wants[i].isSuper(inputTypes[i]));
  }
  return new Apply(func, args);
};

var vectorise = function(func, inputTypes, coercions) {
  var indexes = [];
  for (var i=0; i<coercions.length; i++) {
    if (coercions[i].kind === 'vectorise') {
      indexes.push(i);
      coercions[i] = coercions[i].child || true;
      inputTypes[i] = inputTypes[i].child;
    }
  }
  assert(indexes.length);

  var g = apply(func, inputTypes, coercions);
  return new Vectorise(g, indexes);
};

var intermediate = function(imp, inputTypes) {
  if (any(imp.coercions, c => c.kind === 'vectorise')) {
    var g = vectorise(imp, inputTypes, imp.coercions)
      g.type = type.list(imp.output);
  } else {
    var g = apply(imp, inputTypes, imp.coercions);
    g.type = imp.output;
  }
  return g;
};

var typeCheck = function(name, inputTypes) {
  var imps = type(name, inputTypes);

  if (imps.length === 1) {
    var best = imps[0];
    return intermediate(best, inputTypes);

  } else if (imps.length > 1) {
    return new RuntimeCheck(name);

  } else {
    console.log('no imps for', name, inputTypes);
    return;
  }
};

var typePrim = function(name, inputs) {
  if (any(inputs, x => x === undefined)) return;
  var inputTypes = inputs.map(x => x.type());
  var inputValues = inputs.map(x => x.result);

  switch (name) {
    case 'join %exp':
      var wants = inputTypes.map(t => type.value('Text'));
      //var source = 'join';
      var source = '([' + inputTypes.map((x, index) => '$' + index) + '].join(""))';
      var out = type.value('Text');
      break;

    case 'list %exp':
      if (any(inputTypes, x => x === null)) return;
      var child = type.highest(inputTypes);
      var wants = inputTypes.map(t => child);
      var source = '([' + inputTypes.map((x, index) => '$' + index).join(', ') + '])';
      var out = type.list(child);
      break;

    case 'item %n of %l':
      let [index, list] = inputTypes;
      if (!list) return;
      var wants = [type.value('Int'), type.any];
      var source = '($1[$0 - 1])'; // TODO BigInteger
      var out = list ? list.child || type.any : type.any;
      // TODO await Future cells
      break;

    case 'record with %fields':
      var schema = {};
      var wants = [];
      var source = '(new Record(null, {\n';
      for (var i=0; i<inputTypes.length; i += 2) {
        var symbolType = inputTypes[i];
        if (type.value('Text').isSuper(symbolType) !== true) return;
        var symbol = inputValues[i];
        wants.push(type.value('Text'));

        var child = inputTypes[i + 1];
        if (!child) return;
        schema[symbol] = child;
        wants.push(child);

        source += literalString(symbol) + ': $' + (i + 1) + ',\n';
      }
      source += '}))';
      var out = type.record(schema);
      break;

    case '%q of %o':
      var symbolType = inputTypes[0];
      if (type.value('Text').isSuper(symbolType) !== true) return;
      var obj = inputTypes[1];
      if (!obj) return;
      if (obj.isList && obj.child.isRecord) obj = obj.child;
      if (!obj.isRecord) return;
      var symbol = inputValues[0];
      var schema = {};
      schema[symbol] = type.any;
      var wants = [type.value('Text'), type.record(schema)];
      var source = '($1.values[' + literalString(symbol) + '])';
      var out = obj.schema[symbol];
      break;

    case '%l concat %l':
      var a = inputTypes[0];
      var b = inputTypes[1];
      if (!a || !b) return;
      var out = type.highest([a, b]);
      if (!out.isList) return;
      var wants = [out, out];
      var source = '($0.concat($1))';

    case 'merge %o with %o':
      var wants = [type.record({}), type.record({})];
      var [a, b] = inputTypes;
      if (!a || !b) return;
      var out = type.highest([a, b]);
      var source = '($0.update($1))';
      assert(out.isRecord);
      return; // TODO this
      break;

    case 'update %o with %fields': // 'updateRecord',
      var record = {};
      return; // TODO this
      break;

    default:
      var g = typeCheck(name, inputTypes);
      if (!g && customBlocks.hasOwnProperty(name)) {
        var custom = customBlocks[name];
        console.log('custom:', name);
        var startfn = compileCustom(custom, inputTypes);
        return new Call(name, startfn, inputTypes.map((_, index) => new Arg(index)));
      }
      return g;
  }

  var coercions = wants.map((t, index) => t.isSuper(inputTypes[index]));
  if (!all(coercions, type.validCoercion)) return;
  return intermediate({
    wants: wants,
    coercions: coercions,
    source: source,
    canYield: false,
    output: out,
  }, inputTypes);

};

var isMine = function(node, other) {
  // TODO needed is wrong
  var subs = other.subscribers;
  var mine = true;
  subs.forEach(s => {
    if (s !== node && s.needed && !(s.isBubble && !s.isSink)) {
      mine = false;
    }
  });
  return mine
};

var compileNode = function(node) {
  return typePrim(node.name, node.inputs);
};

var compile = function(node) {
  var g = compileNode(node);
  if (!g) return;
  var type = g.type;

  var op = Func.cache(node.name);
  var base = generate(op, g, node);
  //console.log(base);

  return {type, op, base};
};

/*****************************************************************************/

class Custom {
  constructor(name, graph) {
    this.name = name;
    this.graph = graph;
    this.fns = [];
  }
}

var compileRecursive = function(node, paramTypes) {
  if (node.param !== null) {
    var g = new Arg(node.param);
    g.type = paramTypes[node.param];
    return g;
  }

  if (!node.isComputed) {
    return new Literal(node.result);
  }

  if (customBlocks.hasOwnProperty(node.name)) {
    // TODO
    return;
  }

  var g = typePrim(node.name, node.inputs);
  assert(g instanceof Apply || g instanceof Call);
  // TODO support vectorise
  for (var index=0; index<node.inputs.length; index++) {
    var arg = compileRecursive(node.inputs[index], params);
    g.sub(index, arg);
  }
  return g;
};

var compileCustom = function(custom, paramTypes) {
  var graph = custom.graph;
  var name = custom.name;

  var outputNode;
  Object.keys(graph.nodes).forEach(function(id) {
    var node = graph.nodes[id];
    if (!outputNode || node.y > outputNode.y || (node.y === outputNode.y && node.x > outputNode.x)) {
      outputNode = node;
    }
  });

  var g = compileRecursive(outputNode, paramTypes);

  custom.canYield = false; // TODO

  var startfn = custom.fns.length;
  var base = generate(custom, g);

  return startfn;
};


/*****************************************************************************/

var DEBUG;
//DEBUG = true;

var warnings;
var warn = function(message) {
  warnings[message] = (warnings[message] || 0) + 1;
};

function subst(source, args) {
  return source.replace(/\$[0-9]+/g, function(x) { return args[+x.substr(1)]; });
};

function literalString(e) {
  return '"' + e
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/"/g, '\\"')
    .replace(/\{/g, '\\x7b')
    .replace(/\}/g, '\\x7d') + '"';
}

var generate = function(func, gen) {
  var nextLabel = function() {
    return func.fns.length + fns.length;
  };

  var label = function() {
    var id = nextLabel();
    fns.push(source.length);
    return id;
  };

  var tmps = 0;
  var alpha = 'abcdefghijklmnopqrstuvwxyz';
  var gensym = function() {
    var name = alpha[tmps % 26] + (tmps >= 26 ? tmps / 26 | 0 : '');
    tmps++;
    return name;
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
  };

  var literal = function(e) {
    if (typeof e === 'number' || typeof e === 'boolean') {
      return '' + e;

    } else if (typeof e === 'string') {
      return literalString(e);
    }
    assert(false);
  };

  var val = function(gen, inputs) {
    assert(!gen.canYield);
    assert(isArray(inputs));
    switch (gen.name) {
      case 'apply':
        var src = gen.func.source;
        var args = gen.args.map(a => val(a, inputs));
        assert(typeof src  === 'string');
        if (src[0] === '(') {
          return subst(src, args);
        } else {
          return '(' + src + '(' + args.join(', ') + '))';
        }

      case 'call':
        var func = '(customBlocks[' + gen.spec + '][' + gen.startfn + '])';
        var args = gen.args.map(a => val(a, inputs));
        return '(' + func + '(' + args.join(', ') + '))';

      case 'literal':
        return literal(gen.value);
      case 'arg':
        return inputs[gen.index];
      case 'resolve':
        assert(false);
        break;
      case 'coerce':
        var value = val(gen.child, inputs);
        return subst(gen.source, [value]);

      case 'vectorise':
        var name = gensym();
        vectorise(gen, inputs);
        source += 'var ' + name + ' = l;\n';
        return name;

      case 'list':
      case 'record':
      default:
        assert(false, gen);
    }
  };

  var apply = function(gen, inputs) {
    assert(gen.canYield);
    assert(gen instanceof Apply);
    var func = gen.func;

    var args = gen.args.map(a => val(a,  inputs));
    var names = args.map(function(arg) {
      var name = gensym();
      source += 'var ' + name + ' = ' + arg + ';\n';
      return name;
    });
    var src = gen.func.source;

    var name = gensym();
    source += 'save();\n';
    source += 'R.future = ' + src + '(' + names.join(', ') + ');\n';
    await('R.future');
    source += 'var ' + name + ' = R.future.result;\n';
    source += 'restore();\n';
    return name;
  };

  var call = function(gen, inputs) {
    assert(gen.canYield);
    assert(gen instanceof Call);

    var args = gen.args.map(a => val(a,  inputs));

    var values = args.join(", ");
    source += 'call(' + gen.spec + ', ' + gen.startfn + ', [' + values + '])\n';
    // TODO endCall() in generate
    // TODO emit() here
  };

  var vectorise = function(gen, inputs) {
    var indexes = gen.indexes;
    var child = gen.child;
    assert(child instanceof Apply);
    var func = gen.child.func;
    var args = gen.child.args;

    var childInputs = inputs.slice();
    for (var i=0; i<indexes.length; i++) {
      var index = indexes[i];
      var name = 'vec_' + index;
      source += 'var ' + name + ' = ' + inputs[index] + ';\n';
      inputs[index] = name;
      childInputs[index] = name + '[index]';
    }

    source += 'save();\n';
    source += 'var length = ' + inputs[indexes[0]] + '.length;\n';
    if (indexes.length > 1) {
      var cond = [];
      for (var i=1; i<indexes.length; i++) {
        cond.push(inputs[indexes[i]] + '.length !== R.length');
      }
      source += 'if (' + cond.join(' || ') + ') {\n';
      emit('new Error("Poop")');
      source += '}\n';
    }
    source += 'var l = [];\n';
    source += 'for (var index = 0; index < length; index++) {\n';

    if (child.canYield) {
      // parallel map
      // TODO
      debugger;

    } else {
      // fast vectorise
      source += 'l.push(' + val(child, childInputs) + ');\n';
    }

    source += '}\n';
    source += 'restore();\n';
    return 'l';
  };

  var awaitArgs = function(args) {
    var requestArg = function(gen) {
      switch (gen.name) {
        case 'arg':
          if (!gen.uneval) {
            source += 'await(C.threads[' + gen.index + ']);\n';
          }
          break;
        case 'resolve':
          assert(false);
        case 'coerce':
          requestArg(gen.child);
          break;
        case 'literal':
          break;
        case 'list':
        case 'record':
        default:
          assert(false, gen);
      }
    };

    source += 'C.threads = [\n';
    for (var i=0; i<args.length; i++) {
      source += 'request(' + i + '),\n';
    }
    source += '];\n';
    var names = [];
    for (var i=0; i<args.length; i++) {
      var gen = args[i];
      requestArg(gen);
      var arg = 'C.threads[' + i + ']';
      names.push(gen.uneval ? arg : arg + '.result');
    }
    return names;
  };

  var generate = function(gen) {
    if (gen instanceof RuntimeCheck) {
      // TODO
      source += 'debugger;\n';
      source += 'var x = compile(S);\n';
      source += 'IMMEDIATE = x.base;\n';
      source += 'return;\n';
      return;
    }

    if (gen instanceof Vectorise) {
      var args = awaitArgs(gen.child.args);
      emit(vectorise(gen, args));

    } else if (gen instanceof Literal) {
      emit(val(gen, []));

    } else {
      assert(gen instanceof Apply || gen instanceof Call);
      var args = awaitArgs(gen.args);
      if (gen.canYield) {
        emit(apply(gen, args));
      } else {
        emit(val(gen, args));
      }
    }
  };

  var source = "";
  var startfn = func.fns.length;
  var fns = [0];

  generate(gen);

  for (var i = 0; i < fns.length; i++) {
    func.fns.push(createContinuation(source.slice(fns[i])));
  }
  var f = func.fns[startfn];
  return f;
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

export default {
  node: function(node) {

    warnings = Object.create(null);

    var type = compile(node, []);

    for (var key in warnings) {
      console.warn(key + (warnings[key] > 1 ? ' (repeated ' + warnings[key] + ' times)' : ''));
    }

    return type;
  },

  graph: function(graph) {

    warnings = Object.create(null);

    customBlocks[graph.spec] = new Custom(graph.spec, graph);

    for (var key in warnings) {
      console.warn(key + (warnings[key] > 1 ? ' (repeated ' + warnings[key] + ' times)' : ''));
    }

  },
};

