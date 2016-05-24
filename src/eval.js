
import {bySpec, typeOf, literal} from "./prims";

export class Evaluator {
  constructor(nodes, links) {
    this.nodes = {};
    nodes.forEach(json => this.add(Node.fromJSON(json)));
    links.forEach(json => {
      this.link(this.get(json.from), json.index, this.get(json.to));
    });
    nodes.forEach(node => {
      if (node.isSink) node.request();
    });
    setInterval(this.tick.bind(this), 1000 / 60);

    this.queue = [];
  }

  static fromJSON(json) {
    return new Evaluator(json.nodes, json.links);
  }

  toJSON() {
    var nodes = [];
    var links = [];
    this.nodes.forEach(node => {
      nodes.push(node.toJSON());
      node.inputs.forEach((input, index) => {
        links.push({from: input.id, index: index, to: node});
      });
    });
    return {nodes, links};
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

  onMessage(json) {
    switch (json.action) {
      case 'link':
        var link = this.linkFromJSON(json);
        link.to.replaceArg(link.index, link.from);
        return;
      case 'unlink':
        var link = this.linkFromJSON(json);
        link.to.replaceArg(link.index);
        return;
      case 'setLiteral':
        var node = this.get(json.id);
        node.assign(json.literal);
        return;
      case 'setSink':
        var node = this.get(json.id);
        node.isSink = json.isSink;
        return;
      case 'create':
        var node = json.hasOwnProperty('literal') ? new Observable(json.literal) : new Computed(json.name);
        this.add(node, json.id);
        return;
      case 'destroy':
        var node = this.get(json.id);
        this.remove(node);
        node.destroy();
        return;
      default:
        throw json;
    }
  }

  sendMessage(json) {}

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

  /* * */

  getPrim(name, inputs) {
    var byInputs = bySpec[name];
    if (!byInputs) {
      console.log(`No prims for '${name}'`);
      return {
        output: null,
        func: () => {},
      };
    }

    var hash = inputs.map(typeOf).join(", ");
    var prim = byInputs[hash] || byInputs['Bool, Any, Any']; // TODO
    if (!prim) {
      // TODO type coercion
      console.log(`No prim for '${name}' inputs [${hash}]`);
      return {
        output: null,
        func: () => {},
      };
      // throw new Error(`No prim for '${name}' inputs [${inputs.join(', ')}]`);
    }
    return prim;
  }

  schedule(func) {
    if (this.queue.indexOf(func) === -1) {
      this.queue.push(func);
    }
  }

  unschedule(func) {
    var index = this.queue.indexOf(func);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  tick() {
    var queue = this.queue.slice();
    this.queue = [];
    for (var i=0; i<queue.length; i++) {
      var func = queue[i];
      func();
    }
  }

}
export const evaluator = Evaluator.instance = new Evaluator([], []);

/*****************************************************************************/

export class Observable {
  constructor(value) {
    this._value = value;
    this.subscribers = new Set();
  }
  get isObservable() { return true; }

  assign(value) {
    value = value;
    this._value = value;
    this.subscribers.forEach(o => o.invalidate());
  }

  request() {
    return this._value;
  }

  subscribe(obj) {
    this.subscribers.add(obj);
  }

  unsubscribe(obj) {
    this.subscribers.delete(obj);
  }

}

/*****************************************************************************/

export class Computed extends Observable {
  constructor(block, args) {
    super();
    this.block = block;
    this.args = args = args || [];
    this.reprSubscriber = null;

    this.inputs = block.split(" ").filter(x => x[0] === '%');
    /*
    for (var i=0; i<this.inputs.length; i++) {
      if (this.inputs[i] === '%u') {
        continue;
      }
      if (args[i]) args[i].subscribe(this);
    }
    */

    this._isSink = false;
    this._needed = false;
    this.thread = null;
  }

  get isSink() { return this._isSink; }
  set isSink(value) {
    if (this._isSink === value) return;
    this._isSink = value;
    this.update();
  }

  update() {
    this.needed = this._isSink || !!this.subscribers.size;
  }

  get needed() { return this._needed; }
  set needed(value) {
    if (this._needed === value) return;
    this._needed = value;
    if (this.thread) this.thread.cancel();
    if (value) {
      this.args.forEach((arg, index) => {
        if (this.inputs[index] === '%u') return;
        arg.subscribe(this);
      });

      this.thread = new Thread(this);
      this.thread.start();
    } else {
      this.thread = null;

      this.args.forEach(arg => {
        arg.unsubscribe(this);
      });
    }
  }

  assign(value) { throw "Computeds can't be assigned"; }
  _assign(value) { super.assign(value); }

  replaceArg(index, arg) {
    var old = this.args[index];
    if (old) old.unsubscribe(this);
    this.args[index] = arg;
    if (arg && this.needed && !this.inputs[index] !== '%u') {
      arg.subscribe(this);
      this.invalidate();
    }
    if (arg && this.block === 'display %s') {
      arg.reprSubscriber = this;
    }
  }

  invalidate() {
    if (this.thread) this.thread.cancel();
    evaluator.emit(this, null);
    if (this.needed) {
      this.thread = new Thread(this);
      this.thread.start();
    } else {
      this.thread = null;
    }
    this.subscribers.forEach(o => o.invalidate());
  }

  request() {
    if (!this.thread) throw "oh dear";
    return this.thread;
  }

  subscribe(obj) {
    this.subscribers.add(obj);
    this.update();
  }

  unsubscribe(obj) {
    this.subscribers.delete(obj);
    this.update();
  }

}

/*****************************************************************************/

class Thread {
  constructor(computed) {
    this.target = computed;
    this.inputs = computed.args;

    this.prim = null;

    this.isRunning = false;
    this.isDone = false;
    this.isStopped = false;
    this.waiting = [];
    this.result = null;

    this.loaded = 0;
    this.total = null;
    this.lengthComputable = false;
    this.requests = [];
  }

  get isTask() { return true; }

  toString() {
    return 'Future';
  }

  start() {
    // can be called more than once!
    if (this.isStopped) throw "Can't resume stopped task";
    this.isRunning = true;

    var name = this.target.block;

    var next = () => {
      this.prim = evaluator.getPrim(name, inputs);
      this.schedule(compute);
    };

    var compute = () => {
      var prim = this.prim;
      var func = prim.func;
      var args = inputs.map((obj, index) => {
        if (!obj.isTask) return obj;
        if (this.target.inputs[index] === '%u') {
          debugger;
          return obj;
        }
        return obj.result;
      });
      
      if (prim.coercions) {
        for (var i=0; i<prim.coercions.length; i++) {
          var coerce = prim.coercions[i];
          if (coerce) {
            args[i] = coerce(args[i]);
          }
        }
      }
      var result = func.apply(this, args);
      if (!/Future/.test(prim.output)) {
        this.emit(result);
        this.isRunning = false;
      }
    };

    // this.target.args.forEach(obj => {
    //   if (!(obj.needed || obj.constructor === Observable)) throw 'poo';
    // });

    var inputs = this.inputs.map((obj, index) => {
      if (this.target.inputs[index] === '%u') {
        return obj;
      }
      return obj.request();
    });
    var tasks = inputs.filter(task => task.isTask); // TODO
    this.awaitAll(tasks, next);
  }

  schedule(func) {
    this.func = func;
    evaluator.schedule(func);
  }

  emit(result) {
    if (this.isStopped) return;
    this.isDone = true;
    this.result = result;
    this.dispatchEmit(result);
    evaluator.emit(this.target, result);
    if (this.target.reprSubscriber && !this.target.reprSubscriber.needed) {
      var repr = this.target.reprSubscriber;
      new Thread(repr).start();
    }
  }

  awaitAll(tasks, func) {
    if (!func) throw "noo";
    tasks.forEach(task => {
      if (this.waiting.indexOf(task) === -1) {
        this.requests.push(task);
        if (!task.isDone) this.waiting.push(task);
        task.addEventListener('emit', this.signal.bind(this, task));
        task.addEventListener('progress', this.update.bind(this));
        this.update();
      }
    });
    this.func = func;
    if (!this.waiting.length) {
      this.schedule(func);
      return;
    }
  }

  signal(task) {
    var index = this.waiting.indexOf(task);
    if (index === -1) return;
    this.waiting.splice(index, 1);
    evaluator.schedule(this.func);
  }

  cancel() {
    this.waiting.forEach(task => {
      task.removeEventListener(this);
    });
    this.isRunning = false;
    this.isStopped = true;
    evaluator.unschedule(this.func);
    // TODO
  }

  progress(loaded, total, lengthComputable) {
    if (this.isStopped) return;
    this.loaded = loaded;
    this.total = total;
    this.lengthComputable = lengthComputable;
    this.dispatchProgress({
      loaded: loaded,
      total: total,
      lengthComputable: lengthComputable
    });
    evaluator.progress(this.target, loaded, total);
  }

  update() {
    if (this.isStopped) return;
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
  }

}
import {addEvents} from "./events";
addEvents(Thread, 'emit', 'progress');

/*****************************************************************************/

var compile = function(obj) {

  var source = "";
  var seen = new Set();
  var deps = [];

  var thing = function(obj) {
    seen.add(obj);
    for (var i=0; i<obj.inputs.length; i++) {
      if (obj[i].subscribers.length === 1) {
        thing(obj);
      } else if (seen.has(obj)) {
        continue;
      }
      deps.push(obj);
    }
  };

};


