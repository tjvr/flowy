
import type from "./type";
import compile from "./compile";

function assert(x) {
  if (!x) throw "Assertion failed!";
}

import jsBigInteger from "js-big-integer";
import _fraction from "fraction.js";
import _tinycolor from  "tinycolor2";

var BigInteger = jsBigInteger.BigInteger;
var Fraction = _fraction;
var tinycolor = _tinycolor;

class Record {
  constructor(type, values) {
    //this.type = type || type.record(values);
    this.values = values;
  }

  update(newValues) {
    var values = {};
    this.type.keys().forEach(name => {
      values[name] = this.values[name];
    });
    Object.keys(newValues).forEach(name => {
      values[name] = newValues[name];
    });
    // TODO maintain order
    //return new Record(type.record(values), values);
  }

  toJSON() {
    return this.values;
  }
}

var Time = type.schema('Time', ['hour', 'mins', 'secs']);
var Date_ = type.schema('Date', ['year', 'month', 'day']);
var RGB = type.schema('Rgb', ['red', 'green', 'blue']);
var HSV = type.schema('Hsv', ['hue', 'sat', 'val']);
var WebPage = type.schema('WebPage', ['content-type', 'content']);

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


var runtimeTypeOf = function(value) {
  if (value === undefined) return type.any;
  if (value === null) return;
  switch (typeof value) {
    case 'number':
      if (/^-?[0-9]+$/.test(''+value)) return type.value('Int');
      return type.value('Float');
    case 'string':
      if (value === '') return type.value('Empty');
      return type.value('Text');
    case 'boolean':
      return type.value('Bool');
    case 'object':
      // if (value.isObservable) return type.value('Uneval'); // TODO
      if (value instanceof Thread) {
        return type.future(value.outputType);
      }
      switch (value.constructor) {
        case Error: return type.value('Error');
        case Array: return type.list(type.any);
        case Record: return type.record(value.schema); // TODO
        case BigInteger: return type.value('Int');
        case Image: return type.value('Image');
        case Uncertain: return type.value('Uncertain');
      }
      if (value instanceof Fraction) return type.value('Frac'); // TODO
      if (value instanceof tinycolor) return type.value('Color'); // TODO
  }
  throw "Unknown type: " + value;
};



export const coercions = {
  Text: {
    Int: '($0.toString())',
    Frac: '($0.toString())',
    Float: '($0.toFixed(3))',
    Empty: '("")',
  },
  Float: {
    Text: '(+$0)',
  },
  Frac: {
    Int: '(new Fraction($0, 1))',
  },
  Float: {
    Int: '(+$0.toString())',
  },
  Bool: {
    List: '(!!$0.length)',
  },
  Uncertain: {
    Int: '(new Uncertain($0.toString()))',
    Frac: '(new Uncertain($0.n / $0.d))',
    Float: '(new Uncertain($0))',
  },
};

import {parseSpec} from "./type";
import {functions, byHash} from "./prims";

export const prims = {};
Object.keys(functions).forEach(function(spec) {
  var func = functions[spec];
  var info = parseSpec(spec);

  var spec = byHash[info.hash];
  if (!spec) throw info.hash;

  var inputs = info.inputs;
  var output = info.output;

  var inputTypes = inputs.map(type.fromString);
  var outputType = type.fromString(output);
  prims[spec] = prims[spec] || [];
  prims[spec].push({
    wants: inputTypes,
    output: outputType,
    func: func,
  });
});


var self, S, R, STACK, C, WARP, CALLS, BASE, INDEX, THREAD, IMMEDIATE;

var safely = function(cb) {
  try {
    var value = cb();
  } catch (e) {
    THREAD.emit(e = e instanceof Error ? e : new Error(e));
    // TODO return immediately
    return e;
  }
  return value;
};

var displayAwait = function(computed) {
  THREAD.deps.add(computed);
  if (computed.isComputed) {
    var other = computed.request();
    if (!other) {
      THREAD.emit(['inline', []]); // no implementation
      return;
    }
    if (!other.isDone) {
      var thread = THREAD;
      other.onFirstEmit(function() {
        // awake --restart display()
        self.queue.push(thread);
      });
      return;
    }
  }
  var out = computed.type();
  var value = computed.result;

  var repr = display(out, value);
  if (repr instanceof Future) {
    THREAD.children.push(repr);
    if (!repr.isDone) {
      var thread = THREAD;
      repr.onFirstEmit(thread.emit.bind(thread));
    } else {
      THREAD.emit(repr.result);
    }
  } else {
    THREAD.emit(repr);
  }
}

var display = function(out, result) {
  if (!out || out.isAny) {
    out = runtimeTypeOf(result) || type.any;
  }
  var el = function(type, content) {
    return ['text', 'view-' + type, content || ''];
  };

  if (result === undefined) {
    return ['inline', []]; // undefined result??? eg item of list

  } else if (result instanceof Error) {
    return el('Error', result.message || result);

  } else if (out.isList) {
    return displayList(out, result);

  } else if (out.isRecord) {
    return displayRecord(out, result);

  } else if (out.name) {
    switch (out.name) {
      case 'Text':
        return el('Text', result);
      case 'Bool':
        return el('Symbol view-Bool-' + (result ? 'yes' : 'no'), result ? 'yes' : 'no');
      case 'Int':
        return el('Int', ''+result);
      case 'Float':
        return el('Float', reprFloat(result));
      case 'Frac':
        return ['block', [
          el('Frac-num', ''+result.n),
          ['rect', '#000', 'auto', 2],
          el('Frac-den', ''+result.d),
        ]];
      case 'Uncertain':
        return ['inline', [
          el('Uncertain-mean', ''+result.m),
          el('Uncertain-sym', "±"),
          el('Uncertain-stddev', ''+result.s),
        ]];
      case 'Color':
        return ["rect", $0.toHexString(), 24, 24, "view-Color"];
      case 'Image':
        return ["image", result.cloneNode()];
      default:
        return el('Raw', ''+result);
    }
  }
};

var displayCell = function(out, value) {
  var repr = display(out, value);
  return repr instanceof Future ? repr.result : repr;
};

function withValue(value, cb) {
  if (value instanceof Thread) {
    if (value.isDone) {
      cb(value.result);
    } else {
      value.onFirstEmit(cb);
    }
  } else {
    cb(value);
  }
}

var reprFloat = function(x) {
  var r = ''+x;
  var index = r.indexOf('.');
  if (index === -1) {
    r += '.';
  } else if (index !== -1 && !/e/.test(r)) {
    if (r.length - index > 3) {
      r = x.toFixed(3);
    }
  }
  return r;
};

var displayRecord = function(out, record) {
  var f = new Future();
  // TODO use RecordView
  var schema = record.schema;
  var symbols = schema ? schema.symbols : Object.keys(record.values);
  var items = [];
  var r = ['table', items];
  if (schema) {
    r = ['block', [
      ['text', 'record-title', schema.name, 'auto'],
      r,
    ]];
  }

  symbols.forEach((symbol, index) => {
    var cell = ['cell', 'field', ['text', 'ellipsis', ". . ."]];
    var field = ['row', 'field', index, [
      ['text', 'field-name', symbol],
      ['text', 'field-sym', "→"],
      cell,
    ]];
    items.push(field);

    withValue(record.values[symbol], result => {
      cell[2] = displayCell(type.any, result); // TODO types
      f.emit(r);
    });
  });
  f.emit(r);
  return f;
};

var displayList = function(out, list) {
  var f = new Future();
  var items = [];
  var l = ['table', items];

  var ellipsis = ['text', 'ellipsis', ". . ."];

  if (list.length === 0) {
    // TODO empty lists
    f.emit(l);
    return f;
  }

  var itemType = out.isList ? out.child : type.any;
  var isTyped = !itemType.isAny;
  var isRecordTable;
  withValue(list[0], first => {
    if (!isTyped) {
      itemType = runtimeTypeOf(first);
    }
    isRecordTable = itemType.isRecord;
    if (isRecordTable) {
      // TODO use schema from type
      var schema = first.schema;
      var symbols = schema ? schema.symbols : Object.keys(first.values);
      var headings = symbols.map(text => ['cell', 'header', ['text', 'heading', text], text]);
      items.push(['row', 'header', null, headings]);
    }

    // TODO header row for list lists

    list.forEach((item, index) => {
      var thisItem = runtimeTypeOf(item);
      if (isRecordTable && thisItem.isRecord) {
        items.push(['row', 'record', index, [ellipsis]]);
        withValue(item, result => {
          var values = symbols.map(sym => {
            var value = result.values[sym];
            return ['cell', 'record', displayCell(type.any, value), sym]; // TODO types
          });
          items[index + 1] = ['row', 'record', index, values];
          f.emit(l);
        });

      } else if (thisItem.isList) {
        items.push(['row', 'list', index, [ellipsis]]);
        withValue(item, result => {
          var values = result.map((item2, index2) => {
            return ['cell', 'list', displayCell(thisItem.child, item2), index2 + 1];
          });
          items[index] = ['row', 'list', index, values];
        });

      } else {
        items.push(['row', 'item', index, [ellipsis]]);
        withValue(item, result => {
          var value = ['cell', 'item', displayCell(thisItem, result)];
          items[isRecordTable ? index + 1 : index] = ['row', 'item', index, [value]];
        });
      }
    });
  });
  f.emit(l);
  return f;
};

var mod = function(x, y) {
  var r = x % y;
  if (r / y < 0) {
    r += y;
  }
  return r;
};

var join = function(...strings) {
  return strings.join("");
};

var updateRecord = function(record, ...pairs) {
  var record = record || new Record(null, {});
  if (!(record instanceof Record)) return;
  var values = {};
  for (var i=0; i<pairs.length; i += 2) {
    var name = pairs[i], value = pairs[i + 1];
    values[name] = value;
  }
  var result = record.update(values);
  return result;
};

/* "Record <- merge Record with Record": 'mergeRecords', */
var mergeRecords = function(src, dest) {
  return src.update(dest.values);
};

var range = function(from, to) {
  var result = [];
  for (var i=from; i<=to; i++) {
    result.push(i);
  }
  return result;
};

var repeat = function(times, obj) {
  var out = [];
  for (var i=0; i<times; i++) {
    out.push(obj);
  }
  return out;
};
var repeatText = function(times, obj) {
  var out = "";
  for (var i=0; i<times; i++) {
    out += obj;
  }
  return out;
};

var sampleMean = function(list) {
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
};

var fib = function(n) {
  return n <= 2 ? 1 : fib(n - 1) + fib(n - 2);
};

var mathFunc = function(f, x) {
  switch (f) {
    case 'abs':
      return Math.abs(x);
    case 'floor':
      return Math.floor(x);
    case 'sqrt':
      return Math.sqrt(x);
    case 'ceiling':
      return Math.ceil(x);
    case 'cos':
      return Math.cos(x * Math.PI / 180);
    case 'sin':
      return Math.sin(x * Math.PI / 180);
    case 'tan':
      return Math.tan(x * Math.PI / 180);
    case 'asin':
      return Math.asin(x) * 180 / Math.PI;
    case 'acos':
      return Math.acos(x) * 180 / Math.PI;
    case 'atan':
      return Math.atan(x) * 180 / Math.PI;
    case 'ln':
      return Math.log(x);
    case 'log':
      return Math.log(x) / Math.LN10;
    case 'e ^':
      return Math.exp(x);
    case '10 ^':
      return Math.exp(x * Math.LN10);
  }
  return 0;
};

// TODO Records
var jsonToRecords = function(obj) {
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
};

var recordToList = function(record) {
  var schema = record.schema;
  var values = record.values;
  var symbols = schema ? schema.symbols : Object.keys(values);
  return symbols.map(name => values[name]);
};

var delay = function(duration, value) {
  var f = new Future();
  setTimeout(function() {
    f.emit(value);
  }, duration * 1000);
  return f;
};

var time = function() {
  var f = new Future();
  var interval = setInterval(update, 1000);
  function update() {
    var d = new Date();
    f.emit(new Record(Time, {
      hour: d.getHours(),
      mins: d.getMinutes(),
      secs: d.getSeconds(),
    }));
  }
  f.onCancel(function() {
    clearInterval(interval);
  });
  return f;
};

var date = function() {
  var f = new Future();
  var interval = setInterval(update, 1000);
  function update() {
    var d = new Date();
    f.emit(new Record(Date_, {
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate(),
    }));
  }
  f.onCancel(function() {
    clearInterval(interval);
  });
  return f;
};

var ifElse = function(tv, cond, fv) {
  var f = new Future();
  var computed = cond ? tv : fv;

  THREAD.deps.add(computed);
  if (computed.isComputed) {
    computed.request();
    if (!computed.isDone) {
      computed.onFirstEmit(f.emit.bind(f));
      return f;
    }
  }
  f.emit(computed.result);

  return f;
};

var getURL = function(url) {
  var f = new Future();
  var cors = 'https://crossorigin.me/';
  url = cors + url; //.replace(/^https?\:\/\//, "");
  var xhr = new XMLHttpRequest;
  xhr.open('GET', url, true);
  xhr.onprogress = e => {
    // f.progress(e.loaded, e.total, e.lengthComputable);
  };
  xhr.onload = () => {
    if (xhr.status === 200) {
      f.emit(new Record(WebPage, {
        'content-type': xhr.getResponseHeader('content-type'),
        content: xhr.response,
      }));
    } else {
      f.emit(new Error('HTTP ' + xhr.status + ': ' + xhr.statusText));
    }
  };
  xhr.onerror = () => {
    f.emit(new Error('XHR Error'));
  };
  xhr.responseType = 'blob';
  setTimeout(xhr.send.bind(xhr));
  return f;
};

var readFile = function(r) {
  var f = new Future();
  if (r instanceof Error) {
    f.emit(r);
    return f;
  }
  var mime = r.contentType.split(";")[0];
  var blob = r.response;

  if (/^image\//.test(mime)) {
    var img = new Image();
    img.addEventListener('load', e => {
      f.emit(img);
    });
    img.src = URL.createObjectURL(blob);

  } else if (mime === 'application/json' || mime === 'text/json') {
    var reader = new FileReader;
    reader.onloadend = () => {
      try {
        var json = JSON.parse(reader.result);
      } catch (e) {
        f.emit(new Error("Invalid JSON"));
        return;
      }
      f.emit(jsonToRecords(json));
    };
    reader.onprogress = function(e) {
      //f.progress(e.loaded, e.total, e.lengthComputable);
    };
    reader.readAsText(blob);

  } else if (/^text\//.test(mime)) {
    var reader = new FileReader;
    reader.onloadend = () => {
      f.emit(reader.result);
    };
    reader.onprogress = function(e) {
      //f.progress(e.loaded, e.total, e.lengthComputable);
    };
    reader.readAsText(blob);

  } else {
    f.emit(new Error(`Unknown content type: ${mime}`));
  }
  return f;
};

var save = function() {
  STACK.push(R);
  R = {};
};

var restore = function() {
  R = STACK.pop();
};

var saveCall = function() {
  CALLS.push(C);
  C = {};
};

var restoreCall = function() {
  C = CALLS.pop();
};


// var lastCalls = [];
var call = function(spec, id, values) {
  // lastCalls.push(spec);
  // if (lastCalls.length > 10000) lastCalls.shift();
  var procedure = S.procedures[spec];
  if (procedure) {
    STACK.push(R);
    CALLS.push(C);
    C = {
      base: procedure.fn,
      fn: S.fns[id],
      args: values,
      numargs: [],
      boolargs: [],
      stack: STACK = [],
      warp: procedure.warp
    };
    R = {};
    if (C.warp || WARP) {
      WARP++;
      IMMEDIATE = procedure.fn;
    } else {
      for (var i = CALLS.length, j = 5; i-- && j--;) {
        if (CALLS[i].base === procedure.fn) {
          var recursive = true;
          break;
        }
      }
      if (recursive) {
        self.queue[INDEX] = {
          parent: S,
          base: BASE,
          fn: procedure.fn,
          calls: CALLS
        };
      } else {
        IMMEDIATE = procedure.fn;
      }
    }
  } else {
    IMMEDIATE = S.fns[id];
  }
};

var endCall = function() {
  if (CALLS.length) {
    if (WARP) WARP--;
    IMMEDIATE = C.fn;
    C = CALLS.pop();
    STACK = C.stack;
    R = STACK.pop();
  }
};

var queue = function(id) {
  IMMEDIATE = THREAD.fns[id];
  assert(THREAD.fns.indexOf(IMMEDIATE) !== -1);
  // TODO warp??
};

var forceQueue = function(id) {
  self.queue[INDEX] = THREAD;
  THREAD.fn = THREAD.fns[id];

  // assert(THREAD.parent === S);
  // assert(THREAD.fns === S.fns);
  assert(THREAD.fns.indexOf(THREAD.fn) !== -1);
};

var request = function(index) {
  var computed = THREAD.inputs[index];
  THREAD.deps.add(computed);
  if (computed.isComputed) {
    assert(computed);
    var thread = computed.request();
    assert(computed._type !== null);
    return thread;
  } else {
    return computed;
  }
};

var await = function(thread, id) {
  if (thread instanceof Observable) return;
  var wake = THREAD;
  THREAD.children.push(thread);
  if (!thread.isDone) {
    thread.onFirstEmit(function(result) {
      awake(wake, id);
    });
    return true;
  }
};

var awake = function(thread, id) {
  self.queue.push(thread);
  thread.fn = thread.parent.fns[id];
}

var emit = function(result) {
  THREAD.emit(result);
};

/***************************************************************************/

// Internal definition
class Evaluator {
  constructor() {
    this.queue = [];
    this.baseNow = 0;
  }

  get framerate() { return 60; }

  initRuntime() {
    this.queue = [];
    this.onError = this.onError.bind(this);
  }

  startThread(thread) {
    var index = this.queue.indexOf(thread);
    if (index !== -1) {
      this.queue[index] = undefined;
    }
    this.queue.push(thread);
  }

  stopThread(thread) {
    var index = this.queue.indexOf(thread);
    if (index !== -1) {
      this.queue[index] = undefined;
    }
  }

  start() {
    this.isRunning = true;
    if (this.interval) return;
    addEventListener('error', this.onError);
    this.baseTime = Date.now();
    this.interval = setInterval(this.step.bind(this), 1000 / this.framerate);
  }

  pause() {
    if (this.interval) {
      this.baseNow = this.now();
      clearInterval(this.interval);
      delete this.interval;
      removeEventListener('error', this.onError);
    }
    this.isRunning = false;
  }

  stopAll() {
    this.hidePrompt = false;
    this.prompter.style.display = 'none';
    this.promptId = this.nextPromptId = 0;
    this.queue.length = 0;
    this.resetFilters();
    this.stopSounds();
    for (var i = 0; i < this.children.length; i++) {
      var c = this.children[i];
      if (c.isClone) {
        c.remove();
        this.children.splice(i, 1);
        i -= 1;
      } else if (c.isSprite) {
        c.resetFilters();
        if (c.saying) c.say('');
        c.stopSounds();
      }
    }
  }

  now() {
    return this.baseNow + Date.now() - this.baseTime;
  }

  step() {
    self = this;
    var start = Date.now();
    do {
      var queue = this.queue;
      for (INDEX = 0; INDEX < queue.length; INDEX++) {
        THREAD = queue[INDEX];
        if (THREAD) {
          S = THREAD.parent;
          IMMEDIATE = THREAD.fn;
          BASE = THREAD.base;
          CALLS = THREAD.calls;
          C = CALLS.pop();
          STACK = C.stack;
          R = STACK.pop();
          queue[INDEX] = undefined;
          WARP = 0;
          while (IMMEDIATE) {
            var fn = IMMEDIATE;
            assert(THREAD.fns.indexOf(fn) !== -1);
            IMMEDIATE = null;
            fn();
          }
          STACK.push(R);
          CALLS.push(C);
        }
      }
      for (var i = queue.length; i--;) {
        if (!queue[i]) queue.splice(i, 1);
      }
    } while (Date.now() - start < 1000 / this.framerate && queue.length);
    S = null;
  }

  onError(e) {
    clearInterval(this.interval);
  }

  handleError(e) {
    console.error(e.stack);
  }
}
var evaluator = new Evaluator();
evaluator.start();

class Graph {
  constructor(nodes, links) {
    this.nodes = {};
    this.spec = null;
  }

  add(node, id) {
    if (this.nodes.hasOwnProperty(id)) throw "oops";
    this.nodes[id] = node;
    node.id = id;
  }

  get(nodeId) {
    return this.nodes[nodeId];
  }

  linkFromJSON(json) {
    return {from: this.get(json.from), index: json.index, to: this.get(json.to)};
  }

  invalidate(node) {
    var action = 'invalidate';
    var id = node.id;
    var json = {action, id};
    this.sendMessage(json);
  }

  emit(node, value) {
    var action = 'emit';
    var id = node.id;
    var json = {action, id, value};
    this.sendMessage(json);
  }

  progress(node, loaded, total) {
    var action = 'progress';
    var id = node.id;
    var json = {action, id, loaded, total};
    this.sendMessage(json);
  }

  onMessage(json) {
    switch (json.action) {
      case 'link':
        var link = this.linkFromJSON(json);
        link.to.replace(link.index, link.from);
        break;
      case 'unlink':
        var link = this.linkFromJSON(json);
        link.to.replace(link.index);
        break;
      case 'setLiteral':
        var node = this.get(json.id);
        node.assign(json.literal);
        break;
      case 'setSink':
        var node = this.get(json.id);
        node.setSink(json.isSink);
        break;
      case 'create':
        var node = json.hasOwnProperty('literal') ? new Observable(this, json.literal, json.param) : new Computed(this, json.name);
        this.add(node, json.id);
        break;
      case 'destroy':
        var node = this.get(json.id);
        this.remove(node);
        node.destroy();
        break;
      case 'moved':
        var node = this.get(json.id);
        node.move(json.x, json.y);
        break;
      case 'graphSpec':
        this.spec = json.spec;
        break;
      default:
        throw json;
    }
    this.changed();
  }

  sendMessage(json) {
    json.graph = this.id;
    worker.sendMessage(json);
  }

  changed() {
    if (this.spec) {
      compile.graph(this);
    }
  }
}
Graph.byId = {};

export const worker = {
  onMessage: function(json) {
    if (json.action === 'graph') {
      var graph = new Graph();
      graph.id = json.graph;
      Graph.byId[graph.id] = graph;
      return;
    }
    var graph = Graph.byId[json.graph];
    graph.onMessage(json);
  },
  sendMessage: function(json) {},
};


/***************************************************************************/

class Observable {
  constructor(graph, value, param) {
    this.graph = graph;
    this.result = value;
    this.subscribers = new Set();
    this.x = null;
    this.y = null;
    this.param = param || null;
  }

  subscribe(obj) {
    this.subscribers.add(obj);
  }

  unsubscribe(obj) {
    this.subscribers.delete(obj);
  }

  assign(value) {
    this.result = value;
    this.invalidate();
    this.emit(value);
  }

  invalidate() {
    this.subscribers.forEach(s => s.invalidate(this));
  }

  emit() {
    this.subscribers.forEach(s => s.update(this));
  }

  update() {}

  type() {
    return runtimeTypeOf(this.result);
  }

  move(x, y) {
    this.x = x;
    this.y = y;
  }
}

class Computed extends Observable {
  constructor(graph, name, inputs) {
    super(graph, null);
    this.name = name;
    this.args = name.split(" ").filter(x => x[0] === '%');

    inputs = inputs || [];
    this.isSink = false;
    this.needed = false;
    this.inputs = inputs;
    this.deps = new Set(inputs.filter((arg, index) => (arg && this.args[index] !== '%u')));
    this.base = null;
    this.thread = null;
  }
  get isComputed() { return true; }

  invalidate(arg) {
    //assert(this.deps.has(arg));
    if (this.thread === null) {
      return;
    }
    // if (this.thread) {
    //   this.thread.cancel();
    // }
    this.thread = null;
    this.graph.invalidate(this);
    super.invalidate();
  }

  update(arg) {
    assert(this.deps.has(arg));
    if (this.thread && this.thread.hasStarted && this.thread.deps.has(arg)) {
      this.thread.cancel();
    }
    if (this.needed || this.isBubble) {
      if (!arg.isComputed || arg._type === null) {
        this._type = null;
      }
      this.recompute();
    }
  }

  type() {
    // if (this._type) {
    //   return this._type;
    // }
    if (this.isBubble) {
      this.base = () => {
        displayAwait(this.inputs[0]);
      };
      this.fns = [this.base];
      this._type = type.value('UI');
    } else {
      var x = compile.node(this);
      if (x) {
        this.fns = x.op.fns;
        this.base = x.base;
        this._type = x.type;
      }
      console.log(this._type ? this._type.toString() : "?", '<-', this.name);
    }
    return this._type;
  }

  recompute() {
    this.type();
    if (!this._type) {
      this.setDeps(new Set(this.inputs.filter((arg, index) => (arg && this.args[index] !== '%u'))));
      if (this.result !== null) {
        this.result = null;
        this.emit(null);
      }
    } else {
      var thread = this.thread = new Thread(evaluator, this, this.base);
      thread.onFirstEmit(result => {
        this.result = result;
        this.graph.emit(this, result);
        this.emit(result);

        this.setDeps(thread.deps);
      });
    }
  }

  setDeps(deps) {
    var oldDeps = this.deps;
    this.deps = deps;

    oldDeps.forEach(d => {
      if (!deps.has(d)) d.unsubscribe(this);
    });
    deps.forEach(d => {
      if (!oldDeps.has(d)) d.subscribe(this);
    });
  }

  replace(index, arg) {
    var old = this.inputs[index];
    assert(old !== arg);
    if (arg === undefined && index === this.inputs.length - 1) {
      assert(this.inputs.pop() === old);
    } else {
      this.inputs[index] = arg;
    }
    if (old) {
      if (arg && this.deps.has(old)) {
        this.deps.add(arg);
        this.subscribe(arg);
      }
      if (this.inputs.indexOf(old) === -1) {
        old.unsubscribe(this);
        this.deps.delete(old);
      }
    } else {
      if (arg && this.needed && this.args[index] !== '%u') {
        this.deps.add(arg);
        arg.subscribe(this);
      }
    }
    this.invalidate();
    this._type = null;
    if (this.needed) {
      this.recompute();
    }
  }

  setSink(value) {
    assert(this.isBubble);
    if (this.isSink === value) return;
    this.isSink = value;
    this.updateNeeded();
  }

  get isBubble() {
    return this.name === 'display';
  }

  updateNeeded() {
    var needed = this.isSink || !!this.subscribers.size || this.isBubble;
    if (this.needed === needed) return;
    this.needed = needed;
    if (needed) {
      this.deps.forEach(d => d.subscribe(this));
      this.recompute();
    } else {
      this.deps.forEach(d => d.unsubscribe(this));
    }
  }

  subscribe(obj) {
    super.subscribe(obj);
    this.updateNeeded();
  }

  unsubscribe(obj) {
    super.unsubscribe(obj);
    this.updateNeeded();
  }

  request() {
    if (!this.thread) {
      this.recompute();
    }
    return this.thread;
  }
}

/*****************************************************************************/

import {addEvents} from "./events";


class Future {
  constructor() {
    this.isDone = false;
    this.canceled = false;
    this.result = null;
  }

  emit(result) {
    this.result = result;
    if (!this.isDone) {
      this.isDone = true;
      this.dispatchFirstEmit(result);
    }
    this.dispatchEmit(result);
  }

  cancel() {
  }
}
addEvents(Future, 'firstEmit', 'emit', 'progress', 'cancel');


class Thread extends Future {
  constructor(evaluator, parent, base) {
    super();

    this.evaluator = evaluator;
    this.parent = parent,
    this.base = base;
    this.fn = base;
    this.calls = [{args: [], stack: [{}]}];
    assert(base);

    this.fns = parent.fns;
    this.inputs = parent.inputs;
    this.outputType = parent._type;

    this.hasStarted = false;
    this.deps = new Set();
    this.evaluator.startThread(this);

    this.children = [];
    // TODO composite progress
  }

  cancel() {
    this.evaluator.stopThread(this);
    if (!this.canceled) {
      this.canceled = true;
      this.children.forEach(child => {
        child.cancel();
      });
      this.dispatchCancel();
    }
  }

  emit(result) {
    this.result = result;
    if (!this.isDone) {
      this.isDone = true;
      this.dispatchFirstEmit(result);
    }
    this.dispatchEmit(result);
  }
}

/***************************************************************************/

export const scopedEval = function(source) {
  return eval(source);
};


