
function assert(x) {
  if (!x) throw "Assertion failed!";
}

import {BigInteger} from "js-big-integer";
import Fraction from "fraction.js";
import tinycolor from  "tinycolor2";

window.BigInteger = BigInteger;

class Record {
  constructor(schema, values) {
    this.schema = schema;
    this.values = values;
  }

  update(newValues) {
    var values = {};
    Object.keys(this.values).forEach(name => {
      values[name] = this.values[name];
    });
    Object.keys(newValues).forEach(name => {
      values[name] = newValues[name];
    });
    // TODO maintain order
    return new Record(null, values);
  }
}

class Schema {
  constructor(name, symbols) {
    this.name = name;
    this.symbols = symbols;
    this.symbolSet = new Set(symbols);
    // TODO validation function
  }
}
var Time = new Schema('Time', ['hour', 'mins', 'secs']);
var Date_ = new Schema('Date', ['year', 'month', 'day']);

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



var literals = [
  ["Int", /^-?[0-9]+$/, BigInteger.parseInt],

  ["Frac", /^-?[0-9]+\/[0-9]+$/, x => new Fraction(x)],

  ["Float", /^[0-9]+(?:\.[0-9]+)?e-?[0-9]+$/, parseFloat], // 123[.123]e[-]123
  ["Float", /^(?:0|[1-9][0-9]*)?\.[0-9]+$/,   parseFloat], // [123].123
  ["Float", /^(?:0|[1-9][0-9]*)\.[0-9]*$/,    parseFloat], // 123.[123]

  // ["Text", /^/, x => x],
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

  ["ops", "literal %s"],

  /* Record */

  // TODO
  ["record", "record with %fields"],
  ["record", "update %o with %fields"], // TODO remove??
  ["record", "merge %o with %o"],
  ["record", "%q of %o", ["name"]],

  /* List */

  ["list", "list %exp", ["foo", "bar", "baz"]],
  ["list", "range %n to %n", [1, 5]],
  ["list", "item %n of %l", [1]],
  ["list", "length of %l", []],
  ["list", "%l concat %l"],

  // ["list", "do %r for each %l"],
  // ["list", "keep %r from %l"],
  // ["list", "combine %l with %r"],
  // TODO

  /* Text */

  ["text", "join %exp", ["Hello ", "world"]],
  //["text", "join words %s"],
  ["text", "join %l with %s", ["", " "]],
  //["text", "split words %s"],
  ["text", "split %s by %s", ["", " "]],
  //["text", "split lines %s"],

  /* Math */

  ["math", "%n + %n"],
  ["math", "%n – %n"],
  ["math", "%n × %n"],
  ["math", "%n / %n"],
  ["math", "%n rem %n"],
  ["math", "%n ^ %n", ["", 2]], // TODO pow
  ["math", "round %n"],
  ["math", "float %n"],

  ["math", "%n ± %n"],
  ["math", "mean %n"],
  ["math", "stddev %n"],

  // TODO menus
  ["math", "sqrt of %n", [10]],
  ["math", "sin of %n", [30]],
  ["math", "cos of %n", [60]],
  ["math", "tan of %n", [45]],

  // ["math", "random %n to %n", [1, 10]],

  /* Conditions */

  ["bool", "%s = %s"],
  ["bool", "%s < %s"],
  ["bool", "%b and %b"],
  ["bool", "%b or %b"],
  ["bool", "not %b"],
  ["bool", "%b"],
  ["bool", "%u if %b else %u", ['', true]],

  /* Color */

  ["color", "%c", []],
  ["color", "color %s", ["blue"]],
  // ["color", "color %s", ["#0cb6f7"]],
  ["color", "mix %c with %n %% of %c", ['', 50, '']],
  // ["color", "r %n g %n b %n", [0, 127, 255]],
  // ["color", "h %n s %n v %n", [0, 127, 255]],
  ["color", "brightness of %c", []],
  ["color", "luminance of %c", []],

  ["color", "%c to hex"],
  ["color", "%c to rgb"],
  ["color", "%c to hsv"],
  ["color", "spin %c by %n"],
  // TODO menus
  ["color", "analogous colors %c"],
  ["color", "triad colors %c"],
  ["color", "monochromatic colors %c"],
  ["color", "invert %c"],
  ["color", "complement %c"],

  /* Image */

  /* Web */

  ["sensing", "get %s", ["https://tjvr.org/"]],
  ["sensing", "get %s", ["http://i.imgur.com/svIp9cx.jpg?1"]],

  // ["sensing", "select %s from %html"],

  /* Time */

  ["sensing", "time"],
  ["sensing", "date"],

  // ["sensing", "error"],
  // ["sensing", "delay %s by %n secs", ["", 1]],

];

var byHash = {};
specs.forEach(p => {
  let [category, spec, defaults] = p;
  var hash = spec.split(" ").map(word => word === '%%' ? "%" : /^%/.test(word) ? "_" : word).join(" ");
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

  "UI <- display Error": x => el('Error', x.message || x),
  "UI <- display Text": x => el('Text', x),
  "UI <- display Int": x => el('Int', ''+x),
  "UI <- display Float": x => {
    var r = ''+x;
    var index = r.indexOf('.');
    if (index === -1) {
      r += '.';
    } else if (index !== -1 && !/e/.test(r)) {
      if (r.length - index > 3) {
        r = x.toFixed(3);
      }
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
  "UI <- display Bool": x => {
    var val = x ? 'yes' : 'no';
    return el(`Bool result-Bool-${val}`, val);
  },
  "UI Future <- display Record": function(record) {
    var schema = record.schema;
    var symbols = schema ? schema.symbols : Object.keys(record.values);
    var r = el('Record');
    if (schema) {
      r.appendChild(el('Record-title', schema.name));
    }
    symbols.forEach(symbol => {
      var value = record.values[symbol];
      var field = el('Record-field');
      field.appendChild(el('Record-name', ''+symbol));
      var item = el('Record-value', "...");

      var onEmit = result => {
        item.innerHTML = '';
        var prim = this.evaluator.getPrim("display %s", [result]);
        var result = prim.func.call(this, result);
        if (result) item.appendChild(result);
        this.emit(r);
      };
      if (value && value.isTask) {
        value.withEmit(onEmit);
      } else {
        onEmit(value);
      }

      field.appendChild(item);
      r.appendChild(field);
    });
    this.emit(r);
    return r;
  },
  "UI Future <- display List": function(list) {
    var l = el('List');
    list.forEach(value => {
      var item = el('List-item');

      var onEmit = result => {
        item.innerHTML = '';
        var prim = this.evaluator.getPrim("display %s", [result]);
        var result = prim.func.call(this, result);
        if (result) item.appendChild(result);
        this.emit(l);
      };
      if (value && value.isTask) {
        value.withEmit(onEmit);
      } else {
        onEmit(value);
      }

      l.appendChild(item);
    });
    this.emit(l);
    return l;
  },
  "UI <- display Image": image => {
    var image = image.cloneNode();
    image.className = 'result-Image';
    return image;
  },
  "UI <- display Color": color => {
    var square = el('Color');
    square.style.background = color.toHexString();
    return square;
  },
  "UI <- display Uncertain": uncertain => {
    var f = el('Uncertain');
    f.appendChild(el('Uncertain-mean', ''+uncertain.m));
    f.appendChild(el('Uncertain-sym', "±"));
    f.appendChild(el('Uncertain-stddev', ''+uncertain.s));
    return f;
  },

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

  "Float <- sqrt of Float": x => { return Math.sqrt(x); },
  "Float <- sin of Float": x => Math.sin(Math.PI / 180 * x),
  "Float <- cos of Float": x => Math.sin(Math.PI / 180 * x),
  "Float <- tan of Float": x => Math.sin(Math.PI / 180 * x),

  /* Complex */
  // TODO

  /* Decimal */
  // TODO

  /* Uncertain */
  "Uncertain <- Float ± Float": (mean, stddev) => new Uncertain(mean, stddev),
  "Int <- round Uncertain": x => x.m | 0,
  "Float <- float Uncertain": x => x.m,
  "Bool <- Uncertain = Uncertain": (a, b) => a.m === b.m && a.s === b.s,

  "Uncertain <- mean List": list => {
    if (!list.length) return;
    var s = 0;
    var s2 = 0;
    var n = list.length;
    var u;
    for (var i=n; i--; ) {
      var x = list[i];
      if (x && x.constructor === Uncertain) {
        u = u || 0;
        // TODO average over uncertainties??
        x = x.m;
      }
      s += x;
      s2 += x * x;
    }
    var mean = s / n;
    var variance = (s2 / (n - 1)) - mean * mean;
    return new Uncertain(mean, Math.sqrt(variance));
  },
  "Float <- mean Uncertain": x => x.m,
  "Float <- stddev Uncertain": x => x.s,
  "Uncertain <- Uncertain + Uncertain": Uncertain.add,
  "Uncertain <- Uncertain × Uncertain": Uncertain.mul,

  /* Bool */
  "Bool <- Bool and Bool": (a, b) => a && b,
  "Bool <- Bool or Bool": (a, b) => a || b,
  "Bool <- not Bool": x => !x,
  "Bool <- Bool": x => !!x,
  "Bool <- Bool = Bool": (a, b) => a === b,

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

  /* Text */
  "Text <- literal Text": x => x,
  "Int <- literal Int": x => x,
  "Frac <- literal Frac": x => x,
  "Float <- literal Float": x => x,

  "Bool <- Text = Text": (a, b) => a === b,
  "Text <- join Variadic": (...rest) => rest.join(""),
  "Text <- join List with Text": (l, x) => l.join(x),
  // "Text <- join words List": x => x.join(" "),
  "Text List <- split Text by Text": (x, y) => x.split(y),
  // "Text List <- split words Text": x => x.trim().split(/\s+/g),
  //"Text List <- split lines Text": x => x.split(/\r|\n|\r\n/g),

  /* List */

  "List <- list Variadic": (...rest) => {
    return rest;
  },
  "List <- List concat List": (a, b) => {
    return a.concat(b);
  },
  "List <- range Int to Int": (from, to) => {
    var result = [];
    for (var i=from; i<=to; i++) {
      result.push(i);
    }
    return result;
  },

  "Any Future <- item Int of List": function(index, list) {
    var value = list[index - 1];
    if (value && value.isTask) {
      this.awaitAll([value], () => {
        this.emit(value.result);
      });
    } else {
      this.emit(value);
    }
  },

  "Int <- length of List": function(list) {
    return list.length;
  },


  /* Record */
  "Record <- record with Variadic": (...pairs) => {
    var values = {};
    for (var i=0; i<pairs.length; i += 2) {
      var name = pairs[i], value = pairs[i + 1];
      values[name] = value;
    }
    return new Record(null, values);
  },
  "Record <- update Record with Variadic": (record, ...pairs) => {
    var record = record || new Record(null, {});
    if (!(record instanceof Record)) return;
    var values = {};
    for (var i=0; i<pairs.length; i += 2) {
      var name = pairs[i], value = pairs[i + 1];
      values[name] = value;
    }
    var result = record.update(values);
    return result;
  },
  "Record <- merge Record with Record": (src, dest) => {
    return src.update(dest.values);
  },
  "Any <- Text of Record": (name, record) => {
    if (!(record instanceof Record)) return;
    return record.values[name];
  },

  /* Color */
  // TODO re-implement in-engine
  "Bool <- Color = Color": tinycolor.equals,
  "Color <- Color": x => x,
  "Color <- color Color": x => x,
  "Color <- color Text": x => {
    var color = tinycolor(x);
    if (!color.isValid()) return;
    return color;
  },
  "Color <- mix Color with Float % of Color": (a, mix, b) => tinycolor.mix(a, b, mix),
  //"Color <- r Int g Int b Int": (r, g, b) => {
  //  return tinycolor({r, g, b});
  //},
  //"Color <- h Int s Int v Int": (h, s, v) => {
  //  return tinycolor({h, s, v});
  //},
  "Float <- brightness of Color": x => x.getBrightness(),
  "Float <- luminance of Color": x => x.getLuminance(),
  "Color <- spin Color by Int": (color, amount) => color.spin(amount),
  "Color <- complement Color": x => x.complement(),
  "Color <- invert Color": x => {
    var {r, g, b} = x.toRgb();
    return tinycolor({r: 255 - r, g: 255 - g, b: 255 - b});
  },

  // TODO menus
  "Record <- Color to hex": x => x.toHexString(),
  "Record <- Color to rgb": x => x.toRgb(),
  "Record <- Color to hsv": x => x.toHsv(),

  // TODO menus
  "List <- analogous colors Color": x => x.analogous(),
  "List <- triad colors Color": x => x.triad(),
  "List <- monochromatic colors Color": x => x.monochromatic(),


  /* Async tests */

  "WebPage Future <- get Text": function(url) {
    var xhr = new XMLHttpRequest;
    xhr.open('GET', 'http://crossorigin.me/' + url, true);
    xhr.onprogress = e => {
      this.progress(e.loaded, e.total, e.lengthComputable);
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        var r = {
          contentType: xhr.getResponseHeader('content-type'),
          response: xhr.response,
        };

        var mime = r.contentType;
        var blob = r.response;
        if (/^image\//.test(mime)) {
          var img = new Image();
          img.addEventListener('load', e => {
            this.emit(img);
          });
          img.src = URL.createObjectURL(blob);
        } else if (/^text\//.test(mime) || mime === 'application/json') {
          var reader = new FileReader;
          reader.onloadend = () => {
            this.emit(reader.result);
          };
          reader.onprogress = function(e) {
            //future.progress(e.loaded, e.total, e.lengthComputable);
          };
          reader.readAsText(blob);
        } else {
          this.emit(new Error(`Unknown content type: ${mime}`));
        }
      } else {
        this.emit(new Error('HTTP ' + xhr.status + ': ' + xhr.statusText));
      }
    };
    xhr.onerror = () => {
      this.emit(new Error('XHR Error'));
    };
    xhr.responseType = 'blob';
    setTimeout(xhr.send.bind(xhr));
  },

  "Time Future <- time": function() {
    var update = () => {
      if (this.isStopped) {
        clearInterval(interval);
        return;
      }
      var d = new Date();
      this.emit(new Record(Time, {
        hour: d.getHours(),
        mins: d.getMinutes(),
        secs: d.getSeconds(),
      }));
      this.target.invalidateChildren();
    };
    var interval = setInterval(update, 1000);
    update();
  },

  "Date Future <- date": function() {
    var update = () => {
      if (this.isStopped) {
        clearInterval(interval);
        return;
      }
      var d = new Date();
      this.emit(new Record(Date_, {
        year: d.getFullYear(),
        month: d.getMonth(),
        day: d.getDate(),
      }));
      this.target.invalidateChildren();
    };
    var interval = setInterval(update, 1000);
    update();
  },


  // "A Future <- delay A by Float secs": (value, time) => {
  //   // TODO
  // },
  // "B Future List <- do (B <- A) for each (A Future List)": (ring, list) => {
  //   return runtime.map(ring, list); // TODO
  // },

};

let coercions = {
  "Text <- Int": x => x.toString(),
  "Text <- Frac": x => x.toString(),
  "Text <- Float": x => x.toFixed(2),
  "Text <- Empty": x => "",

  "Float <- Text": x => +x,

  "List <- Empty": x => [],

  // "List <- Int": x => [x],
  // "List <- Frac": x => [x],
  // "List <- Float": x => [x],
  // "List <- Bool": x => [x],
  // "List <- Text": x => [x],
  // "List <- Image": x => [x],
  // "List <- Uncertain": x => [x],

  "Frac <- Int": x => new Fraction(x, 1),
  "Float <- Int": x => +x.toString(),

  "Bool <- List": x => !!x.length,

  "Any <- Int": x => x,
  "Any <- Frac": x => x,
  "Any <- Float": x => x,
  "Any <- Bool": x => x,
  "Any <- Empty": x => x,
  "Any <- Text": x => x,
  "Any <- Image": x => x,
  "Any <- Uncertain": x => x,
  "Any <- Record": x => x,
  "Any <- Time": x => x,
  "Any <- Date": x => x,

  "List <- Record": recordToList,
  "List <- Time": recordToList,
  "List <- Date": recordToList,

  "Record <- Time": x => x,
  "Record <- Date": x => x,

  "Uncertain <- Int": x => new Uncertain(x.toString()),
  "Uncertain <- Frac": x => new Uncertain(x.n / x.d),
  "Uncertain <- Float": x => new Uncertain(x),
};
function recordToList(record) {
  var schema = record.schema;
  var values = record.values;
  var symbols = schema ? schema.symbols : Object.keys(values);
  return symbols.map(name => values[name]);
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
    var hash = inputs.join(", ");
    hash = /Variadic/.test(hash) ? "Variadic" : hash;
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
  if (value === null) return '';
  switch (typeof value) {
    case 'number':
      if (/^-?[0-9]+$/.test(''+value)) return 'Int';
      return 'Float';
    case 'string':
      if (value === '') return 'Empty';
      return 'Text';
    case 'boolean':
      return 'Bool';
    case 'object':
      if (value.isObservable) return 'Uneval'; // TODO
      if (value.isTask) { // TODO
        if (value.isDone) {
          return typeOf(value.result);
        }
        return value.prim ? `${value.prim.output}` : 'Future';
      }
      switch (value.constructor) {
        case Error: return 'Error';
        case BigInteger: return 'Int';
        case Array: return 'List';
        case Image: return 'Image';
        case Uncertain: return 'Uncertain';
        case Record: return value.schema ? value.schema.name : 'Record';
      }
      if (value instanceof Fraction) return 'Frac'; // TODO
      if (value instanceof tinycolor) return 'Color'; // TODO
  }
  throw "Unknown type: " + value;
});

console.log(bySpec);



