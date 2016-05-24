
import {BigInteger} from "js-big-integer";
import Fraction from "fraction.js";

var literals = [
  ["Int", /^-?[0-9]+$/, BigInteger.parseInt],

  ["Frac", /^-?[0-9]+\/[0-9]+$/, x => new Fraction(x)],

  ["Float", /^[0-9]+(?:\.[0-9]+)?e-?[0-9]+$/, parseFloat], // 123[.123]e[-]123
  ["Float", /^(?:0|[1-9][0-9]*)?\.[0-9]+$/,   parseFloat], // [123].123
  ["Float", /^(?:0|[1-9][0-9]*)\.[0-9]*$/,    parseFloat], // 123.[123]

  // ["Str", /^/, x => x],
];

var literalsByType = {};
literals.forEach(l => {
  let [type, pat, func] = l;
  if (!literalsByType[type]) literalsByType[type] = [];
  literalsByType[type].push([pat, func]);
});


export const literal = (value, types) => {
  value = value === undefined ? '' : ''+value;
  //for (var i=0; i<types.length; i++) {
  //  var type = types[i];
  //  var lits = literalsByType[type];
  var lits = literals;
  for (var j=0; j<lits.length; j++) {
    let [type, pat, func] = lits[j];
    if (pat.test(value)) {
      // TODO detect BigInteger
      return func(value);
    }
  }
  return ''+value;
};



export const specs = [

  // TODO auto-ringification
  // TODO multi-line
  // TODO variadic
  // TODO optional arguments

  ["ring", "%s", []],
  ["hidden", "display %s", []],

  ["ops", "id %s"],

  ["math", "%n + %n"],
  ["math", "%n – %n"],
  ["math", "%n × %n"],
  ["math", "%n / %n"],
  ["math", "%n rem %n"],
  ["math", "%n ^ %n", ["", 2]],
  ["math", "round %n"],

  ["math", "sqrt %n", [10]],
  ["math", "sin %n", [30]],
  ["math", "cos %n", [60]],
  ["math", "tan %n", [45]],

  ["ops", "%s = %s"],
  ["ops", "%s < %s"],

  ["bool", "%b and %b"],
  ["bool", "%b or %b"],
  ["bool", "not %b"],
  ["bool", "%b"],
  // TODO gp-like toggle switches

  ["str", "join %s %s"],
  ["str", "join words %s"],
  ["str", "split words %s"],

  ["math", "random %n to %n", [1, 10]],

  ["list", "item %l of %l"],
  ["list", "list %l"],
  ["list", "list %l %l %l"],
  ["list", "range %n to %n", [1, 5]],

  ["list", "do %r for each %l"],
  ["list", "keep %r from %l"],
  ["list", "combine %l with %r"],

  ["sensing", "error"],
  ["sensing", "time"],
  ["sensing", "delay %s by %n secs", ["", 1]],
  ["sensing", "get %s", ["https://tjvr.org/"]],
  ["sensing", "select %s from %html"],

];

var byHash = {};
specs.forEach(p => {
  let [category, spec, defaults] = p;
  var hash = spec.split(" ").map(word => /^%/.test(word) ? "_" : word).join(" ");
  byHash[hash] = spec;
});


class Input {
}

class Spec {
  constructor(category, words, defaults) {
    this.category = category;
    this.words = words;
    // this.inputs = words.filter(x => x.isInput);
    this.defaults = defaults;
  }
}

class Imp {
  constructor(spec, types, func) {

  }
}

export const functions = {

  "Str <- id Str": x => x,

  //"Int <- Float": x => +x.toString(),
  "Int <- Int + Int": BigInteger.add,
  "Int <- Int – Int": BigInteger.subtract,
  "Int <- Int × Int": BigInteger.multiply,
  "Int <- Int rem Int": BigInteger.remainder,
  "Int <- round Int": x => x,
  "Bool <- Int = Int": (a, b) => BigInteger.compareTo(a, b) === 0,
  "Bool <- Int < Int": (a, b) => BigInteger.compareTo(a, b) === -1,
  "Frac <- Int / Int": (a, b) => new Fraction(a, b),
  "Str <- display Int": x => x.toString(),

  //"Frac <- Int": x => new Fraction(x, 1),
  "Frac <- Frac + Frac": (a, b) => a.add(b),
  "Frac <- Frac – Frac": (a, b) => a.sub(b),
  "Frac <- Frac × Frac": (a, b) => a.mul(b),
  "Frac <- Frac / Frac": (a, b) => a.div(b),
  "Float <- Frac": x => x.n / x.d,
  "Str <- display Frac": x => x.toString(),

  // TODO Decimal

  //"Float <- Int": x => +x.toString(),
  "Float <- Float + Float": (a, b) => a + b,
  "Float <- Float – Float": (a, b) => a - b,
  "Float <- Float × Float": (a, b) => a * b,
  "Float <- Float / Float": (a, b) => a / b,
  "Float <- Float rem Float": (a, b) => (((a % b) + b) % b),
  "Int <- round Float": x => BigInteger.parseInt(''+Math.round(x)),
  "Str <- display Float": x => x.toFixed(2),

  "Float <- sqrt Float": Math.sqrt,
  "Float <- sin Float": x => Math.sin(Math.PI / 180 * x),
  "Float <- cos Float": x => Math.sin(Math.PI / 180 * x),
  "Float <- tan Float": x => Math.sin(Math.PI / 180 * x),

  // TODO Complex

  "Str <- display Str": x => x.toString(),

  // "URL <- Str": x => x,

  "WebPage <- get Str": url => {
    // TODO
  },
  "Time Future <- time": () => {
    // TODO
  },
  "A Future <- delay A by Float secs": (value, time) => {
    // TODO
  },
  "B Future List <- do (B <- A) for each (A Future List)": (ring, list) => {
    return runtime.map(ring, list); // TODO
  },

};

var inputShapes = {
  Int: '%n',
  Frac: '%n',
  Float: '%n',
  Str: '%s',
  List: '%l',
};

function parseSpec(spec) {
  var words = spec.split(/([A-Za-z]+|[()]|<-)|\s+/g).filter(x => !!x);
  var tok = words[0];
  var i = 0;
  function next() { tok = words[++i]; }
  function peek() { return words[i + 1]; }

  function assert(x) {
    if (!x) throw "Assertion failed!";
  }

  var isType = (tok => /^[A-Z_]/.test(tok));

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

    var hash = words.join(" ")
    var spec = byHash[hash];
    if (!spec) throw hash;
    return {
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

var bySpec = {};

Object.keys(functions).forEach(function(spec) {
  var info = parseSpec(spec);
  var byInputs = bySpec[info.spec] = bySpec[info.spec] || {};
  byInputs[info.inputs.join(", ")] = {
    inputs: info.inputs,
    output: info.output,
    func: functions[spec],
  };
});

export {bySpec};

export const typeOf = (value => {
  if (value && value.isTask) return value.prim ? `${value.prim.output}` : 'Future';
  if (value && value.constructor === BigInteger || (/^-?[0-9]+$/.test(''+value))) return 'Int';
  if (typeof value === 'number') return 'Float';
  if (typeof value === 'string') return 'Str';
  if (value === undefined) return '';
  throw "Unknown type: " + value;
});

console.log(bySpec);



