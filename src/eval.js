
import {bySpec, typeOf, literal} from "./prims";

class Evaluator {
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

    this.functions = {};

    this._queue = [];
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

  add(node) {
    if (this.nodes.hasOwnProperty(node.id)) throw "oops";
    this.nodes[node.id] = node;
  }

  get(nodeId) {
    return this.nodes[nodeId];
  }

  linkFromJSON(json) {
    return {from: this.get(json.from), index: json.index, to: this.get(json.to)};
  }

  onMessage(json) {
    console.log('>' + json.action, json);
    switch (json.action) {
      case 'link':
        var link = this.linkFromJSON(json);
        link.to.addInput(link.index, link.from);
        return;
      case 'unlink':
        var link = this.linkFromJSON(json);
        link.to.removeInput(link.index);
        return;
      case 'setLiteral':
        var node = this.get(json.id);
        node.setLiteral(json.literal);
        return;
      case 'setSink':
        var node = this.get(json.id);
        node.setSink(json.isSink);
        return;
      case 'create':
        var node = Node.fromJSON(json);
        this.add(node);
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
    return  byInputs[inputs.map(typeOf).join(", ")];
  }

  queue(task) {
    if (this._queue.indexOf(task) === -1) {
      this._queue.push(task);
    }
  }

  unqueue(task) {
    var index = this._queue.indexOf(task);
    if (index !== -1) {
      this._queue.splice(index, 1);
    }
  }

  tick() {
    var queue = this._queue.slice();
    this._queue = [];
    for (var i=0; i<queue.length; i++) {
      var task = queue[i];
      task.think();
    }
  }

}
export const evaluator = Evaluator.instance = new Evaluator([], []);

/*****************************************************************************/

class Node {
  constructor(id, name, literal, isSink) {
    this.id = id == null ? ++Node.highestId : id;
    this.name = name;
    this.literal = literal || null;
    this.isSink = isSink || false;
    this.inputs = [];
    this.outputs = [];

    this.invalid = true;
    this.needed = this.isSink;
    this.requestors = [];
    this.task = new Task(this);
  }

  static fromJSON(json) {
    return new Node(json.id, json.name, json.literal, json.isSink);
  }

  toJSON() {
    return {id: this.id, name: this.name, literal: this.literal, isSink: this.isSink};
  }

  destroy() {
    this.inputs.forEach(node => this.removeInput(this.inputs.indexOf(node)));
    this.outputs.forEach(node => node.removeInput(node.inputs.indexOf(this)));
  }

  /* * */

  addOutput(node) {
    if (this.outputs.indexOf(node) !== -1) return;
    this.outputs.push(node);
  }

  removeOutput(node) {
    var index = this.outputs.indexOf(node);
    if (index === -1) return;
    this.outputs.splice(index, 1);
  }

  addInput(index, node) {
    this.removeInput(index);
    this.inputs[index] = node;
    node.addOutput(this);
    if (this.needed) {
      node.request(this);
    }
    this.invalidate();
  }

  removeInput(index) {
    var oldNode = this.inputs[index];
    if (oldNode) {
      oldNode.removeOutput(this);
      oldNode.cancelRequest(this);
    }
    delete this.inputs[index];
    this.invalidate();
  }

  setLiteral(value) {
    if (this.literal === value) return;
    this.literal = value;
    this.invalidate();
  }

  setSink(isSink) {
    if (this.isSink === isSink) return;
    this.isSink = isSink;
    if (isSink) {
      this.setNeeded(true);
    } else if (this.requestors.length === 0) {
      this.setNeeded(false);
    }
  }

  /* * */

  invalidate() {
    if (!this.invalid) {
      this.invalid = true;
      this.task.stop();
      this.task = new Task(this);

      this.outputs.forEach(node => node.invalidate());
    }
    if (this.needed) {
      this.task.start();
    }
  }

  request(node) {
    if (this.requestors.indexOf(node) !== -1) return;
    this.requestors.push(node);
    this.setNeeded(true);
  }

  cancelRequest(node) {
    var index = this.requestors.indexOf(node);
    if (index === -1) return;
    this.requestors.splice(index, 1);
    if (this.requestors.length === 0 && !this.isSink) {
      this.setNeeded(false);
    }
  }

  setNeeded(needed) {
    console.log(this, needed);
    if (this.needed === needed) return;
    this.needed = needed;
    if (needed) {
      this.inputs.forEach(node => node.request(this));
      this.task.start();
    } else {
      this.inputs.forEach(node => node.cancelRequest(this));
      this.task.stop();
    }
  }

}
Node.highestId = 1;

/*****************************************************************************/

class Task {
  constructor(node) {
    this.node = node;
    this.inputs = [];

    this.prim = null;

    this.isRunning = false;
    this.isDone = false;
    this.isStopped = false;
    this.waiting = [];
    this.func = null;
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
    console.log('start');
    // can be called more than once!
    if (this.isDone || this.isStopped) throw "Can't resume stopped task";
    this.isRunning = true;
    var name = this.node.name;
    if (name === 'literal _') {
      this.result = literal(this.node.literal);
      this.isDone = true;
      this.emit(this.result);
      return;
    }
    var inputs = this.node.inputs.map(node => node.task);
    this.inputs = inputs;
    var prim = this.prim = evaluator.getPrim(name, inputs);
    if (!prim) throw new Error(`No prim for '${name}' inputs [${inputs.join(', ')}]`);
    this.func = prim.func;
    evaluator.queue(this);
  }

  think() {
    this.node.invalid = false;
    this.func(this);
  }

  emit(result) {
    if (this.isStopped) return;
    this.isDone = true;
    this.result = result;
    this.dispatchEmit(result);
    evaluator.emit(this.node, result);
  }

  await(func, ...tasks) {
    this.func = func;
    tasks.forEach(task => {
      if (this.waiting.indexOf(task) === -1) {
        this.requests.push(task);
        this.waiting.push(task);
        task.addEventListener('emit', this.signal.bind(this, task));
        task.addEventListener('progress', this.update.bind(this));
        this.update();
      }
    });
  }

  signal(task) {
    var index = this.waiting.indexOf(task);
    if (index === -1) return;
    this.waiting.remove(task);
    this.resume();
  }

  stop() {
    this.waiting.forEach(task => {
      task.removeEventListener(this);
    });
    this.isRunning = false;
    this.isStopped = true;
    evaluator.unqueue(this);
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
    evaluator.progress(this.node, loaded, total);
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
addEvents(Task, 'emit', 'progress');

/*****************************************************************************/

