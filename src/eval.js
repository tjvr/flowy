

export const specs = [

  // TODO auto-ringification
  // TODO multi-line
  // TODO variadic
  // TODO optional arguments

  ["_", "ring", []],

  ["math", "_ + _"],
  ["math", "_ – _"],
  ["math", "_ × _"],
  ["math", "_ / _"],
  ["math", "_ mod _"],
  ["math", "_ ^ _", ["", 2]],
  ["math", "round _"],

  ["math", "sqrt of _", [10]],
  ["math", "sin of _", [30]],
  ["math", "cos of _", [60]],
  ["math", "tan of _", [45]],

  ["ops", "_ = _"],
  ["ops", "_ < _"],

  ["bool", "_ and _"],
  ["bool", "_ or _"],
  ["bool", "not _"],
  ["bool", "true"],
  ["bool", "false"],
  // TODO gp-like toggle switches

  ["str", "join _ _"],
  ["str", "join words _"],
  ["str", "split words _"],

  ["math", "random _ to _", [1, 10]],

  ["list", "item _ of _"],
  ["list", "list _"],
  ["list", "list _ _ _"],
  ["list", "range _1 to _5"],

  ["list", "do _ring for each _"],
  ["list", "keep _ring from _"],
  ["list", "combine _ with _ring"],

  ["sensing", "error"],
  ["sensing", "time"],
  ["sensing", "delay _ by _ secs"],
  ["sensing", "get _"],
  ["sensing", "select _ from _"],

];

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

import {BigInteger} from "js-big-integer";
import Fraction from "fraction.js";

export const functions = {

  "Int <- Str": x => {
    if (/^-?[0-9]+$/.test(x)) return BigInteger.parseInt(x);
  },
  "Int <- Float": x => +x.toString(),
  "Int <- Int + Int": BigInteger.add,
  "Int <- Int – Int": BigInteger.subtract,
  "Int <- Int × Int": BigInteger.multiply,
  "Int <- Int mod Int": BigInteger.remainder,
  "Int <- round Int": x => x,
  "Bool <- Int = Int": (a, b) => BigInteger.compareTo(a, b) === 0,
  "Bool <- Int < Int": (a, b) => BigInteger.compareTo(a, b) === -1,
  "Frac <- Int / Int": (a, b) => new Fraction(a, b),

  "Frac <- Str": x => {
    if (/^-?[0-9]+\/[0-9]+$/.test(x)) return new Fraction(x);
  },
  "Frac <- Int": x => new Fraction(x, 1),
  "Frac <- Frac + Frac": (a, b) => a.add(b),
  "Frac <- Frac – Frac": (a, b) => a.sub(b),
  "Frac <- Frac × Frac": (a, b) => a.mul(b),
  "Frac <- Frac / Frac": (a, b) => a.div(b),
  "Float <- Frac": x => x.n / x.d,

  // TODO Decimal

  "Float <- Str": x => {
    if (/^-?[0-9]*\.[0-9]+$/.test(x)) return 0+x;
    // TODO e-notation
  },
  "Float <- Int": x => +x.toString(),
  "Float <- Float + Float": (a, b) => a + b,
  "Float <- Float – Float": (a, b) => a + b,
  "Float <- Float × Float": (a, b) => a + b,
  "Float <- Float / Float": (a, b) => a + b,
  "Float <- Float mod Float": (a, b) => (((a % b) + b) % b),
  "Int <- round Float": x => BigInteger.pasreInt(''+Math.round(x)),

  "Float <- sqrt Float": Math.sqrt,
  "Float <- sin Float": x => Math.sin(Math.PI / 180 * x),
  "Float <- cos Float": x => Math.sin(Math.PI / 180 * x),
  "Float <- tan Float": x => Math.sin(Math.PI / 180 * x),

  // TODO Complex


  "URL <- Str": x => x,

  "WebPage Future <- get URL": url => {
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

    return {
      spec: words.join(" "),
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
  (bySpec[info.spec] = bySpec[info.spec] || []).push({
    inputs: info.inputs,
    output: info.output,
    func: functions[spec],
  });
});


class Function {
  constructor() {
  }
}

class Node {
  constructor() {
    this.inputs = [];
    this.outputs = [];
  }
}

