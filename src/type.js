
import {coercions, prims} from "./runtime";

function assert(x) {
  if (!x) throw "Assertion failed!";
}

export function parseSpec(spec) {
  var words = spec.split(/([A-Za-z:]+|[()]|<-)|\s+/g).filter(x => !!x);
  var tok = words[0];
  var i = 0;
  function next() { tok = words[++i]; }
  function peek() { return words[i + 1]; }

  var isType = (tok => /^[A-Z_][a-z]+/.test(tok));

  function pSpec() {
    var words = [];
    while (tok && tok !== '<-') {
      words.push(tok);
      next();
    }
    var outputType = words.join(" ");

    assert(tok === '<-');
    next();

    var words = [];
    var inputTypes = [];
    while (tok) {
      if (tok === '(' || isType(tok)) {
        var type = pType();
        assert(type);
        inputTypes.push(type);
        words.push("_");
      } else {
        words.push(tok);
        next();
      }
    }

    return {
      hash: words.join(" "),
      spec: spec,
      inputs: inputTypes,
      output: outputType,
    }
  }

  function pType() {
    if (isType(tok)) {
      var type = tok;
      next();
      assert(type);
      return type; //[type];
    } else if (tok === '(') {
      next();
      var words = [];
      while (tok !== ')') {
        if (tok === '<-') {
          words = [words];
          words.push("<-");
          next();
          var type = pType();
          assert(type);
          words.push(type);
          break;
        } else if (tok === '*') {
          words.push('*');
          next();
          break;
        }
        var type = pType();
        assert(type);
        words.push(type);
      }
      assert(tok === ')');
      next();
      return words;
    }
  }

  return pSpec();
}

/*****************************************************************************/

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

  static resolve(child)  {
    var kind = 'resolve';
    return child === true ? {kind} : {kind, child};
  }

  static typeCheck(type) {
    var kind = 'check';
    return {kind, type};
  }

  static coerce(from, to)  {
    var map = coercions[to.toString()];
    if (map) {
      var coercion = map[from.toString()];
      if (coercion) {
        var kind = 'coerce';
        return {kind, from, to, coercion};
      }
    }
  }
}

/*****************************************************************************/

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
      case 'Uneval':
        return new UnevalType();
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
    if (!(other instanceof Type)) return false;

    if (other instanceof FutureType) {
      if (t = this.isSuper(other.child)) {
        return Result.resolve(t);
      }
    }

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
      return t; // XXX should be Result.future. cf List, Record
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
      var symbols = this.keys();
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

class UnevalType extends Type {
  toString() { return "Uneval"; }

  isSuper(other) {
    return true;
  }
}

/*****************************************************************************/

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
    // XXX
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

export default function type(name, inputTypes) {
  var imps = prims[name];
  if (!imps) return [];
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
      var out = imp.output;
      best.push({
        coercions: results,
        source: imp.func,
        wants: imp.wants,
        canYield: out.isFuture,
        output: out.isFuture ? out.child : out,
      });
    }
  }

  return best;
};


function highest(types) {
  if (!types.length) {
    return false;
  }
  var t = types[0];
  var o = highest(types.slice(1));
  if (!o) return t;
  if (t.isSuper(o) === true) return t;
  if (o.isSuper(t) === true) return o;
  if (t.isSuper(o).kind === 'coerce') return t;
  if (o.isSuper(t).kind === 'coerce') return o;
  return type.any;
}


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
type.schema = function(name, schema) {
  return new RecordType(name, schema);
};

type.symbol = type.value('Symbol');
type.none = new ValueType('None');
type.any = new AnyType(null);
type.uneval = new UnevalType(null);

type.fromString = Type.fromString;

type.validCoercion = function(x) {
  return x && isValid(x);
};

type.highest = highest;

