
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

  toJSON() {
    return this.values;
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
var RGB = new Schema('Rgb', ['red', 'green', 'blue']);
var HSV = new Schema('Hsv', ['hue', 'sat', 'val']);

function jsonToRecords(obj) {
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
  ["record", "table headings: %l %br rows: %l"],
  ["record", "%o to JSON"],
  ["record", "from JSON %s"],

  /* List */

  ["list", "list %exp", ["foo", "bar", "baz"]],
  ["list", "range %n to %n", [1, 5]],
  ["list", "item %n of %l", [1]],
  ["list", "%l concat %l"],
  ["list", "length of %l", []],
  ["list", "sum %l"],
  // ["list", "count %l", []],
  ["list", "count %l if %r", []],
  ["list", "keep %r from %l"],
  ["list", "for each %l do %r"],
  ["list", "combine %l with %r"],

  // TODO

  /* Text */

  ["text", "join %exp", ["Hello ", "world"]],
  //["text", "join words %s"],
  ["text", "join %l with %s", ["", " "]],
  //["text", "split words %s"],
  ["text", "split %s by %s", ["", " "]],
  //["text", "split lines %s"],
  ["text", "replace %s with %s in %s", ["-", "_", "fish-cake"]],

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
  ["bool", "repeat %n times: %s", [3, 'party']],

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
  ["sensing", "get %s", ["http://api.scratch.mit.edu/users/blob8108"]],

  // ["sensing", "select %s from %html"],

  /* Time */

  ["sensing", "time"],
  ["sensing", "date"],

  // ["sensing", "error"],
  ["sensing", "delay %n secs: %s", [1, ""]],

];

var byHash = {};
specs.forEach(p => {
  let [category, spec, defaults] = p;
  var hash = spec.split(" ").map(word => {
    return word === '%%' ? "%"
         : word === '%br' ? "BR"
         : /^%/.test(word) ? "_"
         : word;
  }).join(" ");
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
  return ['text', 'view-' + type, content || '']
}

function withValue(value, cb) {
  if (value && value.isTask) {
    value.withEmit(() => cb(value.result));
  } else {
    cb(value);
  }
}

export const functions = {

  "UI <- display Error": '(display("Error", $0.message || $0))',
  "UI <- display Text": '(display("Text", $0))',
  "UI <- display Int": '(display("Int", ""+$0))',
  "UI <- display Frac": `(['block', [
    el('Frac-num', ''+$0.n),
    ['rect', '#000', 'auto', 2],
    el('Frac-den', ''+$0.d),
  ]])`,
  "UI <- display Bool": "(display('Symbol view-Bool-' + x ? 'yes' : 'no', x ? 'yes' : 'no'))",
  "UI <- display Image": '(["image", $0.cloneNode()])',
  "UI <- display Color": '(["rect", $0.toHexString(), 24, 24, "view-Color"])',
  "UI <- display Uncertain": `(['inline', [
    el('Uncertain-mean', uncertain.m),
    el('Uncertain-sym', "±"),
    el('Uncertain-stddev', uncertain.s),
  ]])`,
  "UI <- display Float": 'displayFloat',
  "UI <- display Record": 'displayRecord',
  "UI <- display List": 'displayList',

  /* Int */
  "Int <- Int + Int": 'BigInteger.add',
  "Int <- Int – Int": 'BigInteger.subtract',
  "Int <- Int × Int": 'BigInteger.multiply',
  "Int <- Int rem Int": 'BigInteger.remainder',
  "Int <- round Int": '($0)',
  "Bool <- Int = Int": '(BigInteger.compareTo($0, $1) === 0)',
  "Bool <- Int < Int": '(BigInteger.compareTo($0, $1) === -1)',
  "Frac <- Int / Int": '(new Fraction($0, $1))',
  "Float <- float Int": '(+$0.toString())',

  /* Frac */
  "Frac <- Frac + Frac": '($0.add($1))',
  "Frac <- Frac – Frac": '($0.sub($1))',
  "Frac <- Frac × Frac": '($0.mul($1))', 
  "Frac <- Frac / Frac": '($0.div($1))', 
  "Float <- float Frac": '($0.n / $0.d)',
  "Int <- round Frac": '(BigInteger.parseInt(""+Math.round($0.n / $0.d)))', // TODO

  /* Float */
  "Float <- Float + Float": '($0 + $1)',
  "Float <- Float – Float": '($0 - $1)',
  "Float <- Float × Float": '($0 * $1)',
  "Float <- Float / Float": '($0 / $1)',
  "Float <- Float rem Float": 'mod',
  "Int <- round Float": '(BigInteger.parseInt(""+Math.round($0)))',
  "Float <- float Float": '($0)',
  "Bool <- Float = Float": '($0 === $1)',
  "Bool <- Float < Float": '($0 < $1)',

  "Float <- sqrt of Float": '(Math.sqrt($0))',
  "Float <- sin of Float": '(Math.sin(Math.PI / 180 * $0))',
  "Float <- cos of Float": '(Math.cos(Math.PI / 180 * $0))',
  "Float <- tan of Float": '(Math.tan(Math.PI / 180 * $0))',

  /* Complex */
  // TODO

  /* Decimal */
  // TODO

  /* Uncertain */
  "Uncertain <- Float ± Float": '(new Uncertain($0, $1))',
  "Int <- round Uncertain": '($0.m | 0)',
  "Float <- float Uncertain": '($0.m)',
  "Bool <- Uncertain = Uncertain": '($0.m === $1.m && $0.s === $1.s)',

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
    // TODO be actually correct
    return new Uncertain(mean, Math.sqrt(variance));
  },
  "Float <- mean Uncertain": '($0.m)',
  "Float <- stddev Uncertain": '($0.s)',
  "Uncertain <- Uncertain + Uncertain": 'Uncertain.add',
  "Uncertain <- Uncertain × Uncertain": 'Uncertain.mul',

  /* Bool */
  "Bool <- Bool and Bool": '($0 && $1)',
  "Bool <- Bool or Bool": '($0 || $1)',
  "Bool <- not Bool": '(!$0)',
  "Bool <- Bool": '($0)',
  "Bool <- Bool = Bool": '($0 === $1)',

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

  "List <- repeat Int times: Any": function(times, obj) {
    var out = [];
    for (var i=0; i<times; i++) {
      out.push(obj);
    }
    return out;
  },
  "Text <- repeat Int times: Text": function(times, obj) {
    var out = "";
    for (var i=0; i<times; i++) {
      out += obj;
    }
    return out;
  },


  /* Text */
  "Text <- literal Text": '($0)',
  "Int <- literal Int": '($0)',
  "Frac <- literal Frac": '($0)',
  "Float <- literal Float": '($0)',

  "Bool <- Text = Text": '($0 === $1)',
  "Text <- join Variadic": function(...args) {
    var arrays = [];
    var vectorise = [];
    var len;
    for (var index=0; index<args.length; index++) {
      var item = args[index];
      if (item && item.constructor === Array) {
        arrays.push(item);
        vectorise.push(index);
        if (len === undefined) {
          len = item.length;
        } else if (len !== item.length) {
          return new Error("Lists must be same length");
        }
      }
    }
    if (!arrays.length) {
      return args.join("");
    }

    var prim = this.evaluator.getPrim("join %exp", args);
    var Thread = this.constructor;
    var threads = [];
    for (var i=0; i<len; i++) {
      for (var j=0; j<vectorise.length; j++) {
        var index = vectorise[j];
        args[index] = arrays[j][i];
      }
      threads.push(Thread.fake(prim, args.slice()));
    }
    this.awaitAll(threads, () => {});
    return threads;
  },
  "Text <- join List with Text": '($0.join($1))',
  "Text List <- split Text by Text": '($0.split($1))',
  "Text <- replace Text with Text in Text": '($2.replace($0, $1))',

  /* List */

  "List <- list Variadic": (...rest) => {
    return rest;
  },
  "List <- List concat List": '($0.concat($1))',
  "Int List <- range Int to Int": 'range',

  "Any <- item Int of List": '($1[$0])',

  "Int <- sum List": function(list) {
    // TODO
  },

  "Int <- length of List": '($0.length)',
  // "Int <- count List": function(list) {
  //   return list.filter(x => !!x).length;
  // },

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
  "Record Future <- table headings: List BR rows: List": function(symbols, rows) {
    var table = [];
    var init = false;
    rows.forEach((item, index) => {
      table.push(null);
      withValue(item, result => {
        var rec = {};
        for (var i=0; i<symbols.length; i++) {
          var name = symbols[i];
          rec[name] = result[i];
        }
        table[index] = new Record(null, rec);
        if (init) this.emit(table);
      });
    });
    this.emit(table);
    init = true;
  },
  "Text <- Any to JSON": record => {
    return JSON.stringify(record);
  },
  "Text <- List to JSON": record => {
    return JSON.stringify(record);
  },
  "Text <- Record to JSON": record => {
    return JSON.stringify(record);
  },

  "Record <- from JSON Text": text => {
    try {
      var json = JSON.parse(text);
    } catch (e) {
      return new Error("Invalid JSON");
    }
    return jsonToRecords(json);
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
  "Color <- color Rgb": record => {
    var values = record.values;
    var color = tinycolor({ r: values.red, g: values.green, b: values.blue });
    if (!color.isValid()) return;
    return color;
  },
  "Color <- color Hsv": record => {
    var values = record.values;
    var color = tinycolor({ h: values.hue, s: values.sat, v: values.val });
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
  "Record <- Color to rgb": x => {
    var o = x.toRgb();
    return new Record(RGB, { red: o.r, green: o.g, blue: o.b });
  },
  "Record <- Color to hsv": x => {
    var o = x.toHsv();
    return new Record(HSV, { hue: o.h, sat: o.s, val: o.v });
  },

  // TODO menus
  "List <- analogous colors Color": x => x.analogous(),
  "List <- triad colors Color": x => x.triad(),
  "List <- monochromatic colors Color": x => x.monochromatic(),


  /* Async tests */

  "WebPage Future <- get Text": function(url) {
    // TODO cors proxy
    //var cors = 'http://crossorigin.me/http://';
    var cors = 'http://localhost:1337/';
    url = cors + url.replace(/^https?\:\/\//, "");
    var xhr = new XMLHttpRequest;
    xhr.open('GET', url, true);
    xhr.onprogress = e => {
      this.progress(e.loaded, e.total, e.lengthComputable);
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
            this.emit(img);
          });
          img.src = URL.createObjectURL(blob);
        } else if (mime === 'application/json' || mime === 'text/json') {
          var reader = new FileReader;
          reader.onloadend = () => {
            try {
              var json = JSON.parse(reader.result);
            } catch (e) {
              this.emit(new Error("Invalid JSON"));
              return;
            }
            this.emit(jsonToRecords(json));
          };
          reader.onprogress = function(e) {
            //future.progress(e.loaded, e.total, e.lengthComputable);
          };
          reader.readAsText(blob);
        } else if (/^text\//.test(mime)) {
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

  "Bool <- Time < Time": function(a, b) {
    var x = a.values;
    var y = b.values;
    return x.hour < y.hour && x.mins < y.mins && x.secs < y.secs;
  },
  "Bool <- Date < Date": function(a, b) {
    var x = a.values;
    var y = b.values;
    return x.year < y.year && x.month < y.month && x.day < y.day;
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

  "Frac <- Int": x => new Fraction(x, 1),
  "Float <- Int": x => +x.toString(),

  "Bool <- List": x => !!x.length,

  //"List <- Record": recordToList,
  //"List <- Time": recordToList,
  //"List <- Date": recordToList,

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


export const coercionsByType = {};
Object.keys(coercions).forEach(spec => {
  var info = parseSpec(spec);
  assert(info.inputs.length === 1);
  let inp = info.inputs[0];
  let out = info.output;
  var byInput = coercionsByType[out] = coercionsByType[out] || [];
  byInput.push([inp, coercions[spec]]);
});

function parseSpec(spec) {
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
var byName = {};
Object.keys(functions).forEach(function(spec) {
  var info = parseSpec(spec);
  var byInputs = bySpec[info.spec] = bySpec[info.spec] || [];

  var func = functions[spec];
  byInputs.push({
    inputs: info.inputs,
    output: info.output,
    func: func,
  });

  byName[func.name] = func;

});

export {bySpec};

