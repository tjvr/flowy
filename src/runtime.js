
var old = [
  
    // {}  -> Block

    // let _:Word := _:Expr
    // 'T     <- Word

    // 'T Var <- var _:Word
    //           var _:Word := _value:Expr
    // 'T     <- _:Var                     // TODO variable types
    //           _:Var := _:Expr

    // show _:Expr

    "Int <: Expr",
    // ["_:NumberToken",     "Int",  "BigInteger.parseInt(_1)"],
    ["int _:Str",         "Int",  "+BigInteger.toStr(_1)"],
    ["_:Int + _:Int",     "Int",  "BigInteger.add(_1, _2)"],
    ["_:Int - _:Int",     "Int",  "BigInteger.subtract(_1, _2)"],
    ["_:Int × _:Int",     "Int",  "BigInteger.multiply(_1, _2)"],
    ["_:Int ÷ _:Int",     "Int",  "BigInteger.divide(_1, _2)"],
    ["_:Int mod _:Int",   "Int",  "BigInteger.remainder(_1, _2)"],
    ["_:Int < _:Int",     "Bool", "(BigInteger.compareTo(_1, _2) === -1)"],
    ["_:Int = _:Int",     "Bool", "(BigInteger.compareTo(_1, _2) === 0)"],
    ["_:Int > _:Int",     "Bool", "(BigInteger.compareTo(_1, _2) === +1)"],
    ["str _:Int",         "Str",  "BigInteger.toStr(_1)"],
    "",

    "Float <: Expr",
    // ["_:FloatToken",        "Float",  "+_1"],
    // ["float _:Str",         "Float",  "+_1"],
    // ["float _:Int",         "Float",  "+BigInteger.toStr(_1)"],
    ["_:Float + _:Float",   "Float",  "(_1 + _2)"],
    ["_:Float - _:Float",   "Float",  "(_1 - _2)"],
    ["_:Float × _:Float",   "Float",  "(_1 * _2)"],
    ["_:Float ÷ _:Float",   "Float",  "(_1 / _2)"],
    ["_:Float mod _:Float", "Float",  "(((_1 % _2) + _2) % _2)"],
    ["_:Float < _:Float",   "Bool",   "(_1 < _2)"],
    ["_:Float = _:Float",   "Bool",   "(_1 === _2)"],
    ["_:Float > _:Float",   "Bool",   "(_1 > _2)"],
    // ["str _:Float",         "Str",  "('' + _1)"],
    "",

    "Bool <: Expr",
    ["true",                "Bool",   "true"],
    ["false",               "Bool",   "false"],
    ["_:Bool = _:Bool",     "Bool",   "(_1 === _2)"],
    ["not _:Bool",          "Bool",   "!_1"],
    ["_:Bool and _:Bool",   "Bool",   "(_1 && _2)"],
    ["_:Bool or _:Bool",    "Bool",   "(_1 || _2)"],
    "",

    "Str <: Expr",
    // Str <- _:StringToken
    ["_:Str = _:Str",           "Bool",     "(_1 === _2)"],
    ["join *_:Str",             "Str",      "_1.join('')"],
    ["join *_:Str with _:Str",  "Str",      "_1.join(_2)"],
    ["split _:Str by *_:Str",   "Str List", "_1.split(_2)"],
    "",

    "List <: Expr",
    ["list *_:Expr",                  "List",   "_1"],
    ["item _:Int of _:List",              "Expr",    "_1[_2] === undefined ? raise('IndexError') : _1[_2]"],
    ["_:List concat _:List",          "List",   "_1.concat(_2)"],
    ["map _:Block over _:List",       "List",   "_2.map(_1)"],
    ["keep _:Block from _:List",      "List",   "_2.filter(_1)"],
    ["combine _:List with _:Block",   "List",   "_1.reduce(_2)"],
    ["is _:List empty?",              "Bool",   "_1.length === 0"],
    "",

    ["add _item:Expr to _v:(List Var)",                      "Line", "v.push(item);"], // make variadic
    ["insert _item:Expr at _index:Int of _v:(List Var)",     "Line", "v.value.splice(index, 0, item);"], // make variadic. Fix
    ["replace _index:Int of _v:(List Var) with _item:Expr",  "Line", "if (v.value[index] === undefined) raise('IndexError'); v.value[index] = item;"],
    ["delete first of _v:(List Var)",                       "Line", "v.shift();"],
    ["delete last of _v:(List Var)",                        "Line", "v.pop();"],
    ["delete _index:Int of _v:(List Var)",                  "Line", "if (v.value[index] === undefined) raise('IndexError'); v.value.splice(index, 1);"],
    "",

    // ["str _:Expr",                         "Expr",  "('' + _1)"],
    ["if _:Bool then _:Expr else _:Expr",  "Expr",  "(_1 ? _2 : _3)"],
    "",

    // ["_:Block",                               "Line", "_1;"],
    // ["if _:Bool then _:Block else _:Block",   "Line", "if (_1) {\n_2();\n} else {\n_3();\n};"], // elif?
    ["repeat _:Int _:Block",                  "Line", "var __end = _1; for (var i=0; i<__end; i++) {\n_2();\n};"], // TODO gensym
    ["repeat until _:Bool _:Block",           "Line", "while (!_1) {\n_2();\n};"],
    ["for each _:Var of _:List _:Block",      "Line", "_2.forEach(_3.bind(null, _1));"],
    "",

    ["input",      "Int", "123"],
    ["return _:Int",      "Int", "123"],
    ["fib of _:Int",      "Int", "123"],

];

/*
var donePrims = new Map();
var paletteContents = primitives.map(function(prim) {
  if (typeof prim === 'string') return;
  let [spec, type, js] = prim;
  var words = spec.split(/ |(_[a-z]*:\([^)]+\))/g).filter(x => x);

  var hash = words.map(word => {
    return word.split(/:/)[0];
  }).join(" ");
  if (donePrims.has(hash)) return;
  donePrims.set(hash, true);

  var parts = words.map(word => {
    if (/:|^_/.test(word)) {
      var value = "";
      return new Input(value)
    } else {
      return new Label(word);
    }
  });
  return new Node({}, parts);
}).filter(x => !!x);
*/

class RecordType {
  constructor(fields) {
    this.fields = fields;
  }


}

import {BigInteger} from "js-big-integer";
//var BigInteger = yaffle.BigInteger

function imm(f) {
  f.isImmediate = true;
  return f;
}

function isArray(o) {
  return o && o.constructor === Array;
}

function isInt(x) {
  return (x && x.constructor === BigInteger) || /-?[0-9]+/.test(''+x);
}

function Float(x) {
  if (isInt(x)) {
    var val = +x.toString();
  } else {
    var val = +x;
  }
  if (isNaN(val)) throw "NaN";
  return val;
}

function infixMath(name, op) {
  var BI = BigInteger;
  return eval(`imm(function(a, b) {
    if (isInt(a) && isInt(b)) {
      var val = BI.${name}(a, b);
    } else {
      var x = Float(a);
      var y = Float(b);
      var val = ${op};
    }
    return val;
  })`);
}

function round(args, cb) {
  let [x] = args;
  cb(isInt(x) ? x : Math.round(Float(x)));
}

function trig(name) {
  return eval(`(function(deg, cb) {
    cb(Math.${name}(Math.PI / 180 * Float(deg)));
  })`);
}

function sqrt(args, cb) {
  let x = args[0];
  cb(Math.sqrt(Float(x)));
}

function equals(args, cb) {
  let [a, b] = args;
  if (a === b) return cb(true);
  // TODO
  return cb(false);
}

function parseHTML(html) {
  var el = document.createElement('html');
  el.innerHTML = html;
  var el = /^\<\!doctype/i.test(html) ? el : el.querySelector('body');
  return el;
}

export const primitives = {
  "_ + _": infixMath('add', 'x + y'),
  "_ - _": infixMath('subtract', 'x - y'),
  "_ × _": infixMath('multiply', 'x * y'),
  "_ ÷ _": imm((a, b) => Float(a) / Float(b)),
  "_ mod _": infixMath('remainder', '(((x % y) + y) % y)'),
  "round _": imm(x => isInt(x) ? x : Math.round(Float(x))),

  /*
  "join _ _": (args, cb) => {
    let [x, y] = args;
    cb(x, y);
  },

  "sqrt of _": sqrt,

  "sin of _": trig('sin'),
  "cos of _": trig('cos'),
  "tan of _": trig('tan'),

  "_ = _": equals,

  "GET _": (args, cb) => {
    let [url] = args;
    if (!url) cb(null);
    // TODO debounce
    var xhr = new XMLHttpRequest;
    xhr.open('GET', 'http://crossorigin.me/' + url, true);
    xhr.onprogress = function(e) {
      // progress(e.loaded, e.total, e.lengthComputable);
    };
    xhr.onload = function() {
      if (xhr.status === 200) {
        var mime = xhr.getResponseHeader('content-type');
        var response;
        if (/^image\//.test(mime)) {
          var img = new Image();
          img.src = URL.createObjectURL(xhr.response);
          cb(img);
        } else {
          var reader = new FileReader;
          reader.onloadend = function() {
            var text = reader.result;
            if (mime === 'text/html') {
              text = parseHTML(text);
            }
            cb(text);
          };
          reader.readAsText(xhr.response);
        }
        cb(response);
      } else {
        // request.error(new Error('HTTP ' + xhr.status + ': ' + xhr.statusText));
      }
    };
    xhr.onerror = function() {
      // request.error(new Error('XHR Error'));
    };
    xhr.responseType = 'blob';
    setTimeout(xhr.send.bind(xhr));
  },

  "select _ from _": (args, cb) => {
    let [selector, dom] = args;
    cb(selector && dom ? [].slice.apply(dom.querySelectorAll(selector)) : null);
  },

  "delay _ by _ secs": (args, cb) => {
    let [value, secs] = args;
    setTimeout(() => {
      cb(value);
    }, Float(secs) * 1000);
  },

  "time": (args, cb) => {
    setInterval(() => {
      cb(new Date());
    }, 1000);
  },
  */
};

export const literal = text => {
  if (/^-?[0-9]+$/.test(text)) {
    return BigInteger.parseInt(text);
  } else if (text !== '' && text !== '.') {
    var n = +text;
    if (''+n !== 'NaN') {
      return n;
    }
  }
  return ''+text;
};

export const display = value => {
  if (!value) return "";
  if (value.tagName) {
    return value.outerHTML;
  }
  if (isArray(value)) {
    return `[${value.map(display).join(",\n")}]`;
  }
  return '' + value;
}

/*****************************************************************************/

var addEvents = function(cla /*, events... */) {
  [].slice.call(arguments, 1).forEach(function(event) {
    addEvent(cla, event);
  });
};

var addEvent = function(cla, event) {
  var capital = event[0].toUpperCase() + event.substr(1);

  cla.prototype.addEventListener = cla.prototype.addEventListener || function(event, listener) {
    var listeners = this['$' + event] = this['$' + event] || [];
    listeners.push(listener);
    return this;
  };

  cla.prototype.removeEventListener = cla.prototype.removeEventListener || function(event, listener) {
    var listeners = this['$' + event];
    if (listeners) {
      var i = listeners.indexOf(listener);
      if (i !== -1) {
        listeners.splice(i, 1);
      }
    }
    return this;
  };

  cla.prototype.dispatchEvent = cla.prototype.dispatchEvent || function(event, arg) {
    var listeners = this['$' + event];
    if (listeners) {
      listeners.forEach(function(listener) {
        listener(arg);
      });
    }
    var listener = this['on' + event];
    if (listener) {
      listener(arg);
    }
    return this;
  };

  cla.prototype['on' + capital] = function(listener) {
    this.addEventListener(event, listener);
    return this;
  };

  cla.prototype['dispatch' + capital] = function(arg) {
    this.dispatchEvent(event, arg);
    return this;
  };
};

// the value of a node is a Future.
// a Future represents an "execution operation", that is, the evaluation of that node.
// the evaluation of a node depends on the evaluation of its (non-literal) arguments.

class Future {
  constructor() {
    this.loaded = 0;
    this.total = null;
    this.lengthComputable = false;

    this.result = null;
    this.isDone = false;
    this.isError = false;
    this.cancelled = false;
  }
  get isFuture() { return true; }

  cancel() {
    if (this.cancelled) return;
    this.cancelled = true;
    this.dispatchCancel();
  }

  progress(loaded, total, lengthComputable) {
    this.loaded = loaded;
    this.total = total;
    this.lengthComputable = lengthComputable;
    this.dispatchProgress({
      loaded: loaded,
      total: total,
      lengthComputable: lengthComputable
    });
  }

  load(result) {
    this.result = result;
    if (!this.cancelled) {
      this.dispatchLoad(result);
    }
  }

  error(error) {
    this.isDone = false;
    this.isError = false;
    this.dispatchError(error);
  }

  withLoad(cb) {
    this.onLoad(cb);
    if (this.isDone) {
      if (!this.isError) cb(this.result);
    }
  }

  withError(cb) {
    this.onError(cb);
    if (this.isDone) {
      if (this.isError) cb(this.error);
    }
  }

  static all(futures) {
    return new CompositeFuture();
  }
}
addEvents(Future, 'load', 'progress', 'error', 'cancel');


class CompositeFuture extends Future {
  constructor() {
    super();
    this.requests = [];
    this.isDone = true;
    this.update = this.update.bind(this);
    this.error = this.error.bind(this);
    this.defer = false;
  }

  add(request) {
    if (request instanceof CompositeFuture) {
      for (var i = 0; i < request.requests.length; i++) {
        this.add(request.requests[i]);
      }
    } else {
      this.requests.push(request);
      request.addEventListener('progress', this.update);
      request.addEventListener('load', this.update);
      request.addEventListener('error', this.error);
      this.update();
    }
  }

  cancel() {
    if (this.cancelled) return;
    this.requests.forEach(request => {
      if (!request.isDone) request.cancel();
    });
    super.cancel();
  }

  update() {
    if (this.isError || this.cancelled) return;
    var requests = this.requests;
    var i = requests.length;
    var total = 0;
    var loaded = 0;
    var lengthComputable = true;
    var uncomputable = 0;
    var done = 0;
    while (i--) {
      var r = requests[i];
      loaded += r.loaded;
      if (r.isDone) {
        total += r.loaded;
        done += 1;
      } else if (r.lengthComputable) {
        total += r.total;
      } else {
        lengthComputable = false;
        uncomputable += 1;
      }
    }
    if (!lengthComputable && uncomputable !== requests.length) {
      var each = total / (requests.length - uncomputable) * uncomputable;
      i = requests.length;
      total = 0;
      loaded = 0;
      lengthComputable = true;
      while (i--) {
        var r = requests[i];
        if (r.lengthComputable) {
          loaded += r.loaded;
          total += r.total;
        } else {
          total += each;
          if (r.isDone) loaded += each;
        }
      }
    }
    this.progress(loaded, total, lengthComputable);
    this.doneCount = done;
    this.isDone = done === requests.length;
    if (this.isDone && !this.defer) {
      //this.load(this.getResult());
      this.party();
    }
  }

  getResult() {
    throw new Error('Users must implement getResult()');
  }

}



function loadURL(url) {
  var request = new Future;
  var xhr = new XMLHttpRequest;
  xhr.open('GET', url, true);
  xhr.onprogress = function(e) {
    request.progress(e.loaded, e.total, e.lengthComputable);
  };
  xhr.onload = function() {
    if (xhr.status === 200) {
      request.load(xhr.response);
    } else {
      request.error(new Error('HTTP ' + xhr.status + ': ' + xhr.statusText));
    }
  };
  xhr.onerror = function() {
    request.error(new Error('XHR Error'));
  };
  xhr.responseType = 'blob';
  setTimeout(xhr.send.bind(xhr));

  return request;
}

function loadImageURL(url) {
  var request = new Future;
  var image = new Image;
  image.crossOrigin = 'anonymous';
  image.src = url;
  image.onload = function() {
    request.load(image);
  };
  image.onerror = function() {
    request.error(new Error('Failed to load image: ' + url));
  };
  return request;
}

/*****************************************************************************/

export const evaluate = (info, args) => {
  var func = info.prim;
  if (!func) throw func;
  // TODO if (func.isImmediate) {

  var future = new CompositeFuture();
  args.forEach(arg => {
    if (arg && arg.isFuture) future.add(arg);
  });
  future.party = function() {
    var values = args.map(x => x && x.isFuture ? x.result : x);
    try {
      var result = func.apply(null, values);
      future.load(result);
    } catch(e) {
      future.error(e);
      console.log('error', e);
    }
  };
  future.update();
  return future;
}

  /*
  try {
    var func = this.info.prim;
    if (func.isImmediate) {
      return new Future.all(args).then(func);
    } else {
    }

    (args, result => {
      this.value = result;
    });
  } catch (e) {
    this.value = "!!!"; //"Error: " + e;
    console.error(e);
  }
  // setTimeout(() => {
  //   this.value = Math.random() * 50 | 0;
  // }, Math.random() * 100);
  */

