
function assert(x) {
  if (!x) throw "Assertion failed!";
}

import {BigInteger} from "js-big-integer";
import Fraction from "fraction.js";
window.BigInteger = BigInteger;

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
  ["math", "float %n"],

  ["math", "sqrt %n", [10]],
  ["math", "sin %n", [30]],
  ["math", "cos %n", [60]],
  ["math", "tan %n", [45]],

  ["bool", "%s = %s"],
  ["bool", "%s < %s"],

  ["bool", "%b and %b"],
  ["bool", "%b or %b"],
  ["bool", "not %b"],
  ["bool", "%b"],
  // TODO gp-like toggle switches

  // ["str", "join %s %s"],
  // ["str", "join words %s"],
  // ["str", "split words %s"],

  // ["math", "random %n to %n", [1, 10]],

  ["list", "item %n of %l", [1]],
  // ["list", "list %l"],
  // ["list", "list %l %l %l"],
  ["list", "range %n to %n", [1, 5]],

  ["control", "%u if %b else %u", ['', true]],

  // ["list", "do %r for each %l"],
  // ["list", "keep %r from %l"],
  // ["list", "combine %l with %r"],

  // ["sensing", "error"],
  // ["sensing", "time"],
  // ["sensing", "delay %s by %n secs", ["", 1]],
  // ["sensing", "get %s", ["https://tjvr.org/"]],
  // ["sensing", "select %s from %html"],

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

function el(type, content) {
  var el = document.createElement('div');
  el.className = 'result-' + type;
  if (content) el.textContent = content+'\u200b';
  return el;
}

export const functions = {

  "UI <- display Str": x => el('Str', x),
  "UI <- display Int": x => el('Int', ''+x),
  "UI <- display Float": x => {
    var r = ''+x;
    var index = r.indexOf('.');
    if (index === -1) {
      r += '.';
    } else if (index !== -1 && !/e/.test(r)) {
    }
    return el('Float', r);
  },
  "UI <- display Frac": frac => {
    var f = el('Frac');
    f.appendChild(el('Frac-num', ''+frac.n));
    f.appendChild(el('Frac-bar'));
    f.appendChild(el('Frac-den', ''+frac.d));
    return f;
  },
  "UI <- display Bool": x => el('Bool', x ? 'Yes' : 'No'),
  "UI <- display List": (list, runtime) => {
    var l = el('List');
    list.forEach(value => {
      var item = el('List-item');
      item.textContent = ''+value;
      // TODO async contents
      l.appendChild(item);
    });
    return l;
  },

  "Str <- id Str": x => x,

  /* Int */
  "Int <- Int + Int": BigInteger.add,
  "Int <- Int – Int": BigInteger.subtract,
  "Int <- Int × Int": BigInteger.multiply,
  "Int <- Int rem Int": BigInteger.remainder,
  "Int <- round Int": x => x,
  "Bool <- Int = Int": (a, b) => BigInteger.compareTo(a, b) === 0,
  "Bool <- Int < Int": (a, b) => BigInteger.compareTo(a, b) === -1,
  "Frac <- Int / Int": (a, b) => new Fraction(a, b),
  "Float <- float Int": x => +x.toString(),

  /* Frac */
  "Frac <- Frac + Frac": (a, b) => a.add(b),
  "Frac <- Frac – Frac": (a, b) => a.sub(b),
  "Frac <- Frac × Frac": (a, b) => a.mul(b),
  "Frac <- Frac / Frac": (a, b) => a.div(b),
  "Float <- float Frac": x => x.n / x.d,
  "Int <- round Frac": x => BigInteger.parseInt(''+Math.round(x.n / x.d)), // TODO

  /* Float */
  "Float <- Float + Float": (a, b) => a + b,
  "Float <- Float – Float": (a, b) => a - b,
  "Float <- Float × Float": (a, b) => a * b,
  "Float <- Float / Float": (a, b) => a / b,
  "Float <- Float rem Float": (a, b) => (((a % b) + b) % b),
  "Int <- round Float": x => BigInteger.parseInt(''+Math.round(x)),
  "Float <- float Float": x => x,
  "Bool <- Float = Float": (a, b) => a === b,
  "Bool <- Float < Float": (a, b) => a < b,

  "Float <- sqrt Float": x => { return Math.sqrt(x); },
  "Float <- sin Float": x => Math.sin(Math.PI / 180 * x),
  "Float <- cos Float": x => Math.sin(Math.PI / 180 * x),
  "Float <- tan Float": x => Math.sin(Math.PI / 180 * x),

  /* Complex */
  // TODO

  /* Decimal */
  // TODO

  /* Bool */
  "Bool <- Bool and Bool": (a, b) => a && b,
  "Bool <- Bool or Bool": (a, b) => a || b,
  "Bool <- not Bool": x => !x,
  "Bool <- Bool": x => !!x,

  "Any Future <- Uneval if Bool else Uneval": function(tv, cond, fv) {
    var ignore = cond ? fv : tv;
    var want = cond ? tv : fv;
    if (ignore) ignore.unsubscribe(this.target);
    if (want) want.subscribe(this.target);
    var thread = want.request();
    this.awaitAll(thread.isTask ? [thread] : [], () => {
      var result = thread.isTask ? thread.result : thread;
      this.emit(result);
      this.isRunning = false;
    });
  },

  /* List */

  "List <- range Int to Int": (from, to) => {
    var result = [];
    for (var i=from; i<=to; i++) {
      result.push(i);
    }
    return result;
  },

  "Any <- item Int of List": (index, list) => {
    return list[index - 1];
  },

  // "URL <- Str": x => x,

  // "WebPage <- get Str": url => {
  //   // TODO
  // },
  // "Time Future <- time": () => {
  //   // TODO
  // },
  // "A Future <- delay A by Float secs": (value, time) => {
  //   // TODO
  // },
  // "B Future List <- do (B <- A) for each (A Future List)": (ring, list) => {
  //   return runtime.map(ring, list); // TODO
  // },

};

let coercions = {
  "Str <- Int": x => x.toString(),
  "Str <- Frac": x => x.toString(),
  "Str <- Float": x => x.toFixed(2),

  "Frac <- Int": x => new Fraction(x, 1),
  "Float <- Int": x => +x.toString(),

  "Bool <- List": x => !!x.length,
};
var coercionsByType = {};
Object.keys(coercions).forEach(spec => {
  var info = parseSpec(spec);
  assert(info.inputs.length === 1);
  let inp = info.inputs[0];
  let out = info.output;
  var byInput = coercionsByType[out] = coercionsByType[out] || [];
  byInput.push([inp, coercions[spec]]);
});

function parseSpec(spec) {
  var words = spec.split(/([A-Za-z]+|[()]|<-)|\s+/g).filter(x => !!x);
  var tok = words[0];
  var i = 0;
  function next() { tok = words[++i]; }
  function peek() { return words[i + 1]; }

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

function coercify(inputs) {
  if (inputs.length === 0) {
    return [{inputs: [], coercions: []}];
  };
  inputs = inputs.slice();
  var last = inputs.pop();
  var others = coercify(inputs);
  var results = [];
  others.forEach(x => {
    let {inputs, coercions} = x;

    results.push({
      inputs: inputs.concat([last]),
      coercions: coercions.concat([null]),
    });

    var byInput = coercionsByType[last] || [];
    byInput.forEach(c => {
      let [input, coercion] = c;
      results.push({
        inputs: inputs.concat([input]),
        coercions: coercions.concat([coercion]),
      });
    });
  });
  return results;
}

Object.keys(functions).forEach(function(spec) {
  var info = parseSpec(spec);
  var byInputs = bySpec[info.spec] = bySpec[info.spec] || {};

  coercify(info.inputs).forEach((c, index) => {
    let {inputs, coercions} = c;
    if (index === 0) {
      coercions.forEach(c => assert(c === null));
    }
    var hash = inputs.join(", ");
    if (byInputs[hash] && index > 0) {
      return;
    }
    byInputs[hash] = {
      inputs: inputs,
      output: info.output,
      func: functions[spec],
      coercions: coercions,
    };
  });

});

export {bySpec};

export const typeOf = (value => {
  if (value === undefined) return '';
  if (value && value.isTask) {
    if (value.isDone) {
      return typeOf(value.result);
    }
    return value.prim ? `${value.prim.output}` : 'Future';
  }
  if (value && value.constructor === BigInteger || (/^-?[0-9]+$/.test(''+value))) return 'Int';
  if (value && value.constructor === Array) return 'List';
  if (typeof value === 'number') return 'Float';
  if (typeof value === 'string') return 'Str';
  if (typeof value === 'boolean') return 'Bool';
  if (value && value instanceof Fraction) return 'Frac';
  if (value.isObservable) return 'Uneval';
  throw "Unknown type: " + value;
});

console.log(bySpec);



