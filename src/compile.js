
function assert(x) {
  if (!x) throw "Assertion failed!";
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
  constructor(child, coercion) {
    super('coerce', child.canYield);
    this.child = child;
    this.coercion = coercion;
  }
}

class RuntimeCheck extends Gen {
  constructor(name) {
    super('runtime-typing', true);
    this.name = name;
  }
}

/*****************************************************************************/

var coerce = function(child, type, coercion) {
  if (coercion === true) {
    // TODO check child has type?
    return child;
  }
  switch (coercion.kind) {
    case 'list':
      // TODO
      return;
    case 'record':
      // TODO
      return;

    case 'resolve':
      assert(type.isFuture);
      var g = coerce(child, type.child);
      return new Resolve(child);

    case 'coerce':
      assert(coercion.from.isSuper(type));
      var g = coerce(child, coercion.to, true);
      return new Coerce(g, coercion.coercion);

    case 'check':
      assert(false);
  }

};

var apply = function(func, inputTypes, coercions) {
  var args = [];
  for (var i=0; i<inputTypes.length; i++) {
    args.push(coerce(new Arg(i), inputTypes[i], coercions[i]));
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

var typePrim = function(name, inputTypes) {
  switch (name) {
    case 'join %exp':
      // TODO how to type variadics?
      var wants = [];
      for (var i=0; i<inputTypes.length; i++) {
        wants.push(type.string);
      }
      return intermediate({
        wants: wants,
        coercions: [true],
      }, inputTypes);

    case 'item %n of %l':
      let [index, list] = inputTypes;
      g.type = list.child;
      // TODO
      return;

    case 'list %exp':
      g.type = type.list(inputTypes[0]);
      // TODO argh
      return;

    // case '%q of %o':
    //   let [symbol, record] = inputTypes;
    //   assert(type.symbol.isSuper(symbol)); // and is immediate!
    //   var value = TODO get actual symbol value
    //   return record.schema[value];

    // TODO concat...
    // TODO record type
    // TODO list type

    default:
      return typeCheck(name, inputTypes);
  }
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
  var inputTypes = node.inputs.map(x => x.type());

  var g = typePrim(node.name, inputTypes);
  if (!g) return;

  return g;
};

var compile = function(node) {
  var g = compileNode(node);
  if (!g) return;
  var type = g.type;

  var op = Func.cache(node.name);
  var base = generate(op, g, node);
  console.log(base);

  return {type, op, base};
};



/*****************************************************************************/

var DEBUG;
//DEBUG = true;

var warnings;
var warn = function(message) {
  warnings[message] = (warnings[message] || 0) + 1;
};

var generate = function(func, gen, node) {
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

  var subs = function(source, args) {
    return source.replace(/\$[0-9]+/g, function(x) { return args[+x.substr(1)]; });
  };

  var literal = function(e) {
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
    }
    assert(false);
  };

  var val = function(gen, inputs) {
    assert(!gen.canYield);
    switch (gen.name) {
      case 'apply':
        var src = gen.func.source;
        var args = gen.args.map(a => val(a, inputs));
        assert(typeof src  === 'string');
        if (src[0] === '(') {
          return subs(src, args);
        } else {
          return '(' + src + '(' + args.join(', ') + '))';
        }

      case 'literal':
        return literal(gen.value);
      case 'arg':
        return inputs[gen.index];
      case 'resolve':
        assert(false);
        break;
      case 'coerce':
        var value = val(gen.child, inputs);
        return subs(gen.coercion, [value]);

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

  var apply = function(gen) {
    assert(gen.canYield);
    assert(gen instanceof Apply);
    var func = gen.func;
    var args = gen.args;

    var requestArgs = function(gen) {
      switch (gen.name) {
        case 'arg':
          source += 'C.threads[' + gen.index + '] = request(' + gen.index + ');\n';
          break;
        case 'resolve':
        case 'coerce':
          requestArgs(gen.child);
          break;
        case 'list':
        case 'record':
        default:
          assert(false, gen);
      }
    };

    var arg = function(gen) {
      switch (gen.name) {
        case 'arg':
          var name = 'arg_' + gen.index;
          source += 'var ' + name + ' = C.threads[' + gen.index + '];\n';
          return name;
        case 'resolve':
          var name = arg(gen.child);
          source += 'await(' + name + ');\n';
          var result = gensym();
          source += 'var ' + result + ' = ' + name + '.result;\n';
          return result;
        case 'coerce':
          var name = arg(gen.child);
          var result = gensym();
          source += 'var ' + result + ' = ' + subs(gen.coercion, [name]) + ';\n';
        case 'list':
        case 'record':
        default:
          assert(false, gen);
      }
    };

    source += 'C.threads = [];\n';

    args.forEach(requestArgs);
    var names = args.map(arg);
    var src = gen.func.source;

    var name = gensym();
    if (func.canYield) {
      source += 'save();\n';
      source += 'R.future = ' + src + '(' + names.join(', ') + ');\n';
      await('R.future');
      source += 'var ' + name + ' = R.future;\n';
      source += 'restore();\n';
    } else if (src[0] === '(') {
      source += 'var ' + name + ' = ' + subs(src, names) + ';\n';
    } else {
      source += 'var ' + name + ' = ' + src + '(' + names.join(', ') + ');\n';
    }
    return name;
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
      source += 'var ' + name + ' = ' + (inputs[index] || '[]') + ';\n';
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

  var generate = function(gen) {
    if (gen instanceof RuntimeCheck) {
      // TODO
      source += 'debugger;\n';
      source += 'var x = compile(S);\n';
      source += 'IMMEDIATE = x.base();\n';
      source += 'return;\n';
      return;
    }

    if (gen instanceof Vectorise) {
      var args = [];
      source += 'C.threads = [\n';
      for (var i=0; i<node.inputs.length; i++) {
        //assert(node.inputs[i] instanceof Observable);
        source += 'request(' + i + '),\n';
      }
      source += '];\n';
      for (var i=0; i<node.inputs.length; i++) {
        source += 'await(C.threads[' + i + ']);\n';

        var arg = node.inputs[i];
        args.push('C.threads[' + i + '].result');
      }

      emit(vectorise(gen, args));
      return;
    }

    assert(gen instanceof Apply);
    if (gen.canYield) {
      emit(apply(gen));
    } else {
      var args = [];
      source += 'C.threads = [\n';
      for (var i=0; i<node.inputs.length; i++) {
        //assert(node.inputs[i] instanceof Observable);
        source += 'request(' + i + '),\n';
      }
      source += '];\n';
      for (var i=0; i<node.inputs.length; i++) {
        source += 'await(C.threads[' + i + ']);\n';

        var arg = node.inputs[i];
        args.push('C.threads[' + i + '].result');
      }
      emit(val(gen, args));
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

export default function(node) {

  warnings = Object.create(null);

  var type = compile(node, []);

  for (var key in warnings) {
    console.warn(key + (warnings[key] > 1 ? ' (repeated ' + warnings[key] + ' times)' : ''));
  }

  return type;
};

