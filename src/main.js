
import tinycolor from  "tinycolor2";

function assert(x) {
  if (!x) throw "Assertion failed!";
}

function extend(src, dest) {
  src = src || {};
  dest = dest || {};
  for (var key in src) {
    if (src.hasOwnProperty(key) && !dest.hasOwnProperty(key)) {
      dest[key] = src[key];
    }
  }
  return dest;
}

function clone(val) {
  if (val == null) return val;
  if (val.constructor == Array) {
    return val.map(clone);
  } else if (typeof val == "object") {
    var result = {}
    for (var key in val) {
      result[clone(key)] = clone(val[key]);
    }
    return result;
  } else {
    return val;
  }
}

function el(tagName, className) {
  var d = document.createElement(className ? tagName : 'div');
  d.className = className || tagName || '';
  return d;
}

/*****************************************************************************/



var PI12 = Math.PI * 1/2;
var PI = Math.PI;
var PI32 = Math.PI * 3/2;

function containsPoint(extent, x, y) {
  return x >= 0 && y >= 0 && x < extent.width && y < extent.height;
}

function opaqueAt(context, x, y) {
  return containsPoint(context.canvas, x, y) && context.getImageData(x, y, 1, 1).data[3] > 0;
}

function bezel(context, path, thisArg, inset, scale) {
  if (scale == null) scale = 1;
  var s = inset ? -1 : 1;
  var w = context.canvas.width;
  var h = context.canvas.height;

  context.beginPath();
  path.call(thisArg, context);
  context.fill();
  // context.clip();

  context.save();
  context.translate(-10000, -10000);
  context.beginPath();
  context.moveTo(-3, -3);
  context.lineTo(-3, h+3);
  context.lineTo(w+3, h+3);
  context.lineTo(w+3, -3);
  context.closePath();
  path.call(thisArg, context);

  context.globalCompositeOperation = 'source-atop';

  context.shadowOffsetX = (10000 + s * -1) * scale;
  context.shadowOffsetY = (10000 + s * -1) * scale;
  context.shadowBlur = 1.5 * scale;
  context.shadowColor = 'rgba(0, 0, 0, .7)';
  context.fill();

  context.shadowOffsetX = (10000 + s * 1) * scale;
  context.shadowOffsetY = (10000 + s * 1) * scale;
  context.shadowBlur = 1.5 * scale;
  context.shadowColor = 'rgba(255, 255, 255, .4)';
  context.fill();

  context.restore();
}

/*****************************************************************************/

import {evaluator, Observable, Computed} from "./eval";
import {compile} from "./compile";
window.compile = compile;

evaluator.sendMessage = onMessage;

function sendMessage(json) {
  //console.log(`=> ${json.action}`, json);
  evaluator.onMessage(json);
}

function onMessage(json) {
  //console.log(`<= ${json.action}`, json);
  switch (json.action) {
    case 'emit':
      Node.byId[json.id].emit(json.value);
      return;
    case 'progress':
      Node.byId[json.id].progress(json.loaded, json.total);
      return;
  }
}

class Node {
  constructor(id, name, literal, isSink) {
    this.id = id || ++Node.highestId;
    this.name = name;
    this.literal = literal || null;
    this.isSink = isSink || false;
    this.inputs = [];
    this.outputs = [];

    //sendMessage({action: 'create', id: this.id, name: this.name, literal: this.literal, isSink: this.isSink});
    Node.byId[this.id] = this;
  }

  destroy() {
    sendMessage({action: 'destroy', id: this.id});
    delete Node.byId[this.id];
    this.inputs.forEach(node => this.removeInput(this.inputs.indexOf(node)));
    this.outputs.forEach(node => node.removeInput(node.inputs.indexOf(this)));
  }

  static input(literal) {
    var name = "literal _";
    var node = new Node(null, name, literal, false);
    sendMessage({action: 'create', id: node.id, name: name, literal: literal});
    return node;
  }
  static block(name) {
    var node = new Node(null, name, null, false);
    sendMessage({action: 'create', id: node.id, name: name});
    return node;
  }
  static repr(node) {
    var name = "display %s";
    var repr = new Node(null, name, null, false);
    sendMessage({action: 'create', id: repr.id, name: name, isSink: false});
    repr.addInput(0, node);
    return repr;
  }

  /* * */

  _addOutput(node) {
    if (this.outputs.indexOf(node) !== -1) return;
    this.outputs.push(node);
  }

  _removeOutput(node) {
    var index = this.outputs.indexOf(node);
    if (index === -1) return;
    this.outputs.splice(index, 1);
  }

  addInput(index, node) {
    this.removeInput(index);
    this.inputs[index] = node;
    node._addOutput(this);
    sendMessage({action: 'link', from: node.id, index: index, to: this.id});
  }

  removeInput(index) {
    var oldNode = this.inputs[index];
    if (oldNode) {
      oldNode._removeOutput(this);
      sendMessage({action: 'unlink', from: oldNode.id, index: index, to: this.id});
    }
    this.inputs[index] = null;
  }

  setLiteral(value) {
    if (this.literal === value) return;
    this.literal = value;
    sendMessage({action: 'setLiteral', id: this.id, literal: this.literal});
  }

  setSink(isSink) {
    if (this.isSink === isSink) return;
    this.isSink = isSink;
    sendMessage({action: 'setSink', id: this.id, isSink: this.isSink});
  }

  /* * */

  emit(value) {
    this.value = value;
    this.dispatchEmit(value);
  }

  progress(loaded, total) {
    this.dispatchProgress({loaded, total});
  }

}
Node.highestId = 0;
Node.byId = {};

import {addEvents} from "./events";
addEvents(Node, 'emit', 'progress');

/*****************************************************************************/

var density = 2;

var metricsContainer = el('metrics-container');
document.body.appendChild(metricsContainer);

function createMetrics(className) {
  var field = el('metrics ' + className);
  var node = document.createTextNode('');
  field.appendChild(node);
  metricsContainer.appendChild(field);

  var stringCache = Object.create(null);

  return function measure(text) {
    if (hasOwnProperty.call(stringCache, text)) {
      return stringCache[text];
    }
    node.data = text + '\u200B';
    return stringCache[text] = {
      width: field.offsetWidth,
      height: field.offsetHeight
    };
  };
}

class Drawable {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.width = null;
    this.height = null;
    this.el = null;

    this.parent = null;
    this.dirty = true;
    this.graphicsDirty = true;
    this.lastTap = 0;

    this._zoom = 1;
  }

  moveTo(x, y) {
    this.x = x | 0;
    this.y = y | 0;
    this.transform();
  }

  set zoom(value) {
    this._zoom = value;
    this.transform();
  }

  transform() {
    var t = '';
    t += `translate(${this.x + (this._flip ? 1 : 0)}px, ${this.y}px)`;
    if (this._zoom !== 1) t += ` scale(${this._zoom})`;
    t += ' translateZ(0)';
    this.el.style.transform = t;
  }

  moved() {}

  layout() {
    if (!this.parent) return;

    this.layoutSelf();
    this.parent.layout();
  }

  layoutChildren() { // assume no children
    if (this.dirty) {
      this.dirty = false;
      this.layoutSelf();
    }
  }

  /*
   * just draw children. Called when Drawable::workspace changes I think?
   */
  drawChildren() { // assume no children
    if (this.graphicsDirty) {
      this.graphicsDirty = false;
      this.draw();
    }
  }

  redraw() {
    if (this.workspace) {
      this.graphicsDirty = false;
      this.draw();
    } else {
      this.graphicsDirty = true;
    }

    // for debugging
    this.el.style.width = this.width + 'px';
    this.el.style.height = this.height + 'px';
  }

  // layoutSelf() {}
  // draw() {}

  get app() {
    var o = this;
    while (o && !o.isApp) {
      o = o.parent;
    }
    return o;
  }

  get workspace() {
    var o = this;
    while (o && !o.isWorkspace) {
      o = o.parent;
    }
    return o;
  }

  get workspacePosition() {
    var o = this;
    var x = 0;
    var y = 0;
    while (o && !o.isWorkspace) {
      x += o.x;
      y += o.y;
      o = o.parent;
    }
    return {x, y};
  }

  get screenPosition() {
    var o = this;
    var x = 0;
    var y = 0;
    while (o && !o.isWorkspace && !o.isApp) {
      x += o.x;
      y += o.y;
      o = o.parent;
    }
    if (o && !o.isApp) {
      return o.screenPositionOf(x, y);
    }
    return {x, y};
  }

  get topScript() {
    var o = this;
    while (o.parent) {
      if (o.parent.isWorkspace) return o;
      o = o.parent;
    }
    return null;
  }

  click() {
    this.lastTap = +new Date();
  }
  isDoubleTap() {
    return +new Date() - this.lastTap < 400;
  }


  setHover(hover) {}
}


class Label extends Drawable {
  constructor(text, cls) {
    assert(typeof text === 'string');
    super();
    this.el = el('absolute label ' + (cls || ''));
    this.text = text;
  }

  get text() { return this._text; }
  set text(value) {
    this._text = value;
    this.el.textContent = value;
    var metrics = Label.measure(value);
    this.width = metrics.width;
    this.height = metrics.height * 1.2 | 0;
    this.layout();
  }

  objectFromPoint(x, y) { return null; }

  copy() {
    return new Label(this.text);
  }

  layoutSelf() {}
  drawChildren() {}
  draw() {}

  get dragObject() {
    return this.parent.dragObject;
  }
}
Label.prototype.isLabel = true;
Label.measure = createMetrics('label');


class Input extends Drawable {
  constructor(value, shape) {
    super();

    this.el = el('absolute');
    this.el.appendChild(this.canvas = el('canvas', 'absolute'));
    this.context = this.canvas.getContext('2d');

    this.el.appendChild(this.field = el('input', 'absolute field text-field'));

    this.shape = shape;

    this.field.addEventListener('input', this.change.bind(this));
    this.field.addEventListener('keydown', this.keyDown.bind(this));

    this.node = Node.input(value);
    this.value = value;
  }

  get isInput() { return true; }

  get isDraggable() {
    return this.workspace && this.workspace.isPalette;
  }
  get dragObject() {
    return this.parent.dragObject;
  }

  get value() { return this._value; }
  set value(value) {
    value = ''+value;
    this._value = value;
    if (this.field.value !== value) {
      this.field.value = value;
    }
    if (this.shape === 'Color') {
      value = tinycolor(value);
    } else {
      value = literal(value);
    }
    this.node.setLiteral(value);
    this.layout();
  }

  get shape() { return this._shape; }
  set shape(value) {
    this._shape = value;
    this.color = '#fff';
    this.pathIcon = null;
    switch (value) {
      case 'Num':
        this.pathFn = this.pathCircle;
        break;
      case 'Menu':
      case 'Color':
        this.pathFn = this.pathSquare;
        break;
      case 'Symbol':
        this.pathFn = this.pathTag;
        break;
      case 'List':
        this.pathFn = this.pathObj;
        this.pathIcon = this.pathListIcon;
        break;
      case 'Record':
        this.pathFn = this.pathObj;
        this.pathIcon = this.pathRecordIcon;
        break;
      default:
        this.pathFn = this.pathRounded;
    }
  }

  change(e) {
    this.value = this.field.value;
    this.layout();
    assert(this.parent);
  };
  keyDown(e) {
    // TODO up-down to increment number
  }

  copy() {
    return new Input(this._value, this.shape);
  }

  replaceWith(other) {
    this.parent.replace(this, other);
  }

  click() {
    super.click();
    if (this.shape === 'Color') {
      this.field.focus();
      return;
    }
    this.field.select();
    this.field.setSelectionRange(0, this.field.value.length);
  }

  objectFromPoint(x, y) {
    return opaqueAt(this.context, x * density, y * density) ? this : null;
  }

  draw() {
    this.canvas.width = this.width * density;
    this.canvas.height = this.height * density;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.context.scale(density, density);
    this.drawOn(this.context);
  }

  drawOn(context) {
    context.fillStyle = this.color;
    bezel(context, this.pathFn, this, true, density);

    if (this.pathIcon) {
      context.save();
      context.fillStyle = 'rgba(255, 255, 255, 0.5)';
      this.pathIcon(context);
      context.closePath();
      context.fill();
      context.restore();
    }
  }

  pathRounded(context, r) {
    var w = this.width;
    var h = this.height;
    var r = r !== undefined ? r : 6;
    context.moveTo(0, r + .5);
    context.arc(r, r + .5, r, PI, PI32, false);
    context.arc(w - r, r + .5, r, PI32, 0, false);
    context.arc(w - r, h - r - .5, r, 0, PI12, false);
    context.arc(r, h - r - .5, r, PI12, PI, false);
  }

  pathCircle(context) {
    this.pathRounded(context, this.height / 2);
  }

  pathObj(context) {
    this.pathRounded(context, density * 2);
  };

  pathSquare(context) {
    this.pathRounded(context, density);
  }

  pathTag(context) {
    var w = this.width;
    var h = this.height;
    var r = h / 2;
    context.moveTo(0, 0);
    context.lineTo(w - r, 0);
    context.lineTo(w, r);
    context.lineTo(w - r, h);
    context.lineTo(0, h);
  }

  pathRecordIcon(context) {
    var s = 22 / 16;
    context.translate(0, 1);
    context.scale(s, s);

    for (var y=0; y<=7; y+=7) {
      context.moveTo(1, y + 3);
      context.lineTo(4, y + 3);
      context.lineTo(4, y + 1.5);
      context.lineTo(7, y + 4);
      context.lineTo(4, y + 6.5);
      context.lineTo(4, y + 5);
      context.lineTo(1, y + 5);

      context.moveTo(9, y + 2);
      context.lineTo(12.5, y + 2);
      context.lineTo(15, y + 2);
      context.lineTo(15, y + 6);
      context.lineTo(9, y + 6);
    }
  }

  pathListIcon(context) {
    var s = 22 / 16;
    context.scale(s, s);

    for (var y=4; y<=12; y += 4) {
      context.moveTo(2, 3);
      context.arc(3.5, y, 1.5, 0, 2 * Math.PI);

      context.rect(6.5, y - 1, 8, 2);
    }
  }

  layoutSelf() {
    var isColor = false;
    if (this.shape === 'Menu' || this.shape === 'Record' || this.shape === 'List') {
      var can = document.createElement('canvas');
      var c = can.getContext('2d');
      c.fillStyle = this.parent.color;
      c.fillRect(0, 0, 1, 1);
      c.fillStyle = 'rgba(0,0,0, .15)';
      c.fillRect(0, 0, 1, 1);
      var d = c.getImageData(0, 0, 1, 1).data;
      var s = (d[0] * 0x10000 + d[1] * 0x100 + d[2]).toString(16);
      this.color = '#' + '000000'.slice(s.length) + s;
    } else if (this.shape === 'Color') {
      this.color = this.value;
      isColor = true;
    } else {
      this.color = '#f7f7f7';
    }

    var metrics = isColor ? { width: 12, height: 20 }
                          : Input.measure(this.field.value);
    this.height = metrics.height + 3;

    var pl = 0;
    var pr = 0;
    if (this.pathFn === this.pathTag) {
      pr = this.height / 2 - 4;
    }

    var w = Math.max(this.height, Math.max(this.minWidth, metrics.width) + this.fieldPadding * 2);
    this.width = w + pl + pr;

    this.field.className = 'absolute field text-field field-' + this.shape;
    this.field.type = isColor ? 'color' : '';
    if (isColor) {
      this.field.style.width = `${this.width}px`;
      this.field.style.height = `${this.height}px`;
      this.field.style.left = '0';
    } else {
      this.field.style.width = `${w}px`;
      this.field.style.height = `${this.height}px`;
      this.field.style.left = `${pl}px`;
    }

    this.redraw();
  }

  pathShadowOn(context) {
    this.pathFn(context);
    context.closePath();
  }

}
Input.measure = createMetrics('field');

Input.prototype.minWidth = 8;
Input.prototype.fieldPadding = 4;




class Switch extends Drawable {
  constructor(value) {
    super();

    this.el = el('absolute switch');
    this.el.appendChild(this.canvas = el('canvas', 'absolute'));
    this.context = this.canvas.getContext('2d');

    this.knob = new SwitchKnob(this);
    this.el.appendChild(this.knob.el);

    this.node = Node.input(value);
    this.value = value;
  }

  get isSwitch() { return true; }

  copy() {
    return new Switch(this.value);
  }

  replaceWith(other) {
    this.parent.replace(this, other);
  }

  get isDraggable() {
    return true;
  }
  get dragObject() {
    return this.parent.dragObject;
  }

  objectFromPoint(x, y) {
    return (this.knob.objectFromPoint(x - this.knob.x, y - this.knob.y) || opaqueAt(this.context, x * density, y * density) ? this : null);
  }

  get value() { return this._value; }
  set value(value) {
    if (this._value === value) return;
    this._value = value;
    this.node.setLiteral(value);
    this.knob.moveTo(this._value ? 32 - 20 + 3 : -3, -2);
    this.color = this._value ? '#64c864' : '#b46464';
    this.redraw();
  }

  click() {
    super.click();
    this.value = !this.value;
  }

  layoutSelf() {
    this.width = 32;
    this.height = 14;
    this.redraw();
  }

  layoutChildren() {
    this.knob.layout();
    this.layoutSelf();
  }

  draw() {
    this.canvas.width = this.width * density;
    this.canvas.height = this.height * density;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.context.scale(density, density);
    this.drawOn(this.context);
  }

  drawOn(context) {
    context.fillStyle = this.color;
    bezel(context, this.pathFn, this, true, density);
  }

  pathFn(context) {
    var w = this.width;
    var h = this.height;
    var r = 8;

    context.moveTo(0, r + .5);
    context.arc(r, r + .5, r, PI, PI32, false);
    context.arc(w - r, r + .5, r, PI32, 0, false);
    context.arc(w - r, h - r - .5, r, 0, PI12, false);
    context.arc(r, h - r - .5, r, PI12, PI, false);
  }

  pathShadowOn(context) {
    this.pathFn(context);
    context.closePath();
  }

}

class SwitchKnob extends Drawable {
  constructor(parent) {
    super();
    this.parent = parent;

    this.el = el('absolute switch-knob');
    this.el.appendChild(this.canvas = el('canvas', 'absolute'));
    this.context = this.canvas.getContext('2d');

    this.color = '#bbc';
    this.layoutSelf();
  }

  objectFromPoint(x, y) {
    return opaqueAt(this.context, x * density, y * density) ? this : null;
  }

  get isDraggable() {
    return true;
  }
  get dragObject() {
    return this.parent.dragObject;
  }

  click() {
    super.click();
    this.parent.click();
  }

  layoutSelf() {
    this.width = 20;
    this.height = 20;
    this.redraw();
  }

  draw() {
    this.canvas.width = this.width * density;
    this.canvas.height = this.height * density;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.context.scale(density, density);
    this.drawOn(this.context);
  }

  drawOn(context) {
    context.fillStyle = this.color;
    bezel(context, this.pathFn, this, false, density);
  }

  pathFn(context) {
    var w = this.width;
    var h = this.height;
    var r = 10;

    context.moveTo(0, r + .5);
    context.arc(r, r + .5, r, PI, PI32, false);
    context.arc(w - r, r + .5, r, PI32, 0, false);
    context.arc(w - r, h - r - .5, r, 0, PI12, false);
    context.arc(r, h - r - .5, r, PI12, PI, false);
  }
}



class Arrow extends Drawable {
  constructor(icon, action) {
    super();
    this.icon = icon;
    this.pathFn = icon === '▶' ? this.pathAddInput
                : icon === '◀' ? this.pathDelInput : assert(false);
    this.action = action;

    this.el = el('absolute');
    this.el.appendChild(this.canvas = el('canvas', 'absolute'));
    this.context = this.canvas.getContext('2d');
    this.setHover(false);

    this.layoutSelf();
  }

  get isArrow() { return true; }

  objectFromPoint(x, y) {
    var px = 4;
    var py = 4;
    var touchExtent = {width: this.width + px * 3, height: this.height + py * 3};
    if (containsPoint(touchExtent, x + px, y + py)) {
      return this;
    }
  }

  setHover(hover) {
    this.color = hover ? '#5B57C5' : '#333';
  }

  get color() { return this._color; }
  set color(value) {
    this._color = value;
    this.redraw();
  }

  get isDraggable() {
    return true;
  }
  get dragObject() {
    return this.parent.dragObject;
  }
  copy() {
    return new Arrow(this.icon, this.action);
  }

  click() {
    super.click();
    this.action.call(this.parent);
  }

  layoutSelf() {
    this.width = 14;
    this.height = 14;
    this.redraw();
  }

  draw() {
    this.canvas.width = this.width * density;
    this.canvas.height = this.height * density;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.context.scale(density, density);
    this.drawOn(this.context);
  }

  drawOn(context) {
    context.strokeStyle = this.color;
    context.lineWidth = 0.5 * density;
    this.pathFn(context);
    context.closePath();
    context.stroke();
  }

  pathCircle(context) {
    var w = this.width;
    var h = this.height;
    var r = h / 2;
    context.moveTo(0, r + 1);
    context.arc(r, r + 1, r, PI, PI32, false);
    context.arc(w - r, r + 1, r, PI32, 0, false);
    context.arc(w - r, h - r - 1, r, 0, PI12, false);
    context.arc(r, h - r - 1, r, PI12, PI, false);
  }

  pathDelInput(context) {
    var w = this.width;
    var h = this.height;
    var t = 1.5 * density;
    this.pathCircle(context);
    context.moveTo(t, h / 2);
    context.lineTo(w - t, h / 2);
  }

  pathAddInput(context) {
    var w = this.width;
    var h = this.height;
    var t = 1.5 * density;
    this.pathCircle(context);
    context.moveTo(t, h / 2);
    context.lineTo(w - t, h / 2);
    context.moveTo(w / 2, t);
    context.lineTo(w / 2, h - t);
  }

}


class Block extends Drawable {
  constructor(info, parts) {
    super();

    this.el = el('absolute');
    this.el.appendChild(this.canvas = el('canvas', 'absolute'));
    this.context = this.canvas.getContext('2d');

    this.parts = [];
    this.labels = [];
    this.args = [];

    this.node = Node.block(info.spec);
    this.repr = Node.repr(this.node);

    this.info = info;
    for (var i=0; i<parts.length; i++) {
      this.add(parts[i]);
    }
    this.inputs = this.parts.filter(p => !p.isLabel && !p.isArrow);

    this.color = info.color; //'#7a48c3';

    this.outputs = [];
    this.curves = [];
    this.blob = new Blob(this);
    this.bubble = new Bubble(this);
    this.el.appendChild(this.bubble.el);
    this.addOutput(this.bubble);
    this.bubble.parent = this;
  }

  get isBlock() { return true; }
  get isDraggable() { return true; }

  get parent() { return this._parent; }
  set parent(value) {
    this._parent = value;
    if (!this.outputs) return;
    this.updateSinky();
  }

  get color() { return this._color }
  set color(value) {
    this._color = value;
    this.redraw();
  }

  add(part) {
    this.insert(part, this.parts.length);
  }

  insert(part, index) {
    assert(part !== this);
    if (part.parent) part.parent.remove(part);
    part.parent = this;
    part.zoom = 1;
    this.parts.splice(index, 0, part);
    if (this.parent) part.layoutChildren(); // TODO
    this.layout();
    this.el.appendChild(part.el);

    var array = part.isLabel || part.isArrow ? this.labels : this.args;
    array.push(part); // TODO

    if (!part.isLabel && !part.isArrow) {
      var index = array.length - 1;
      this.node.addInput(index, part.node);
    }
  }

  replace(oldPart, newPart) {
    assert(newPart !== this);
    if (oldPart.parent !== this) return;
    if (newPart.parent) newPart.parent.remove(newPart);
    oldPart.parent = null;
    newPart.parent = this;
    newPart.zoom = 1;

    var index = this.parts.indexOf(oldPart);
    this.parts.splice(index, 1, newPart);

    var array = oldPart.isLabel ? this.labels : this.args;
    var index = array.indexOf(oldPart);
    array.splice(index, 1, newPart);

    newPart.layoutChildren();
    newPart.redraw();
    this.layout();
    if (this.workspace) newPart.drawChildren();

    this.el.replaceChild(newPart.el, oldPart.el);

    this.node.addInput(index, newPart.node);
  };

  remove(part) {
    if (part.parent !== this) return;
    if (part.isBubble) {
      if (this.bubble === part) {
        this.removeBubble(part);
      }
      return;
    }

    part.parent = null;
    var index = this.parts.indexOf(part);
    this.parts.splice(index, 1);
    this.layout();
    this.el.removeChild(part.el);

    var array = part.isLabel || part.isArrow ? this.labels : this.args;
    var index = array.indexOf(part);
    array.splice(index, 1);

    this.node.removeInput(index);
    // TODO shift up others??
  }

  addOutput(output) {
    this.outputs.push(output);
    output.target = this;

    var curve = new Curve(this, output);
    output.curve = curve;
    this.curves.push(curve);

    this.layoutBubble(output);
  }

  removeOutput(output) {
    var index = this.outputs.indexOf(output);
    this.outputs.splice(index, 1);
    output.parent = null;
  }

  addBubble(bubble) {
    assert(bubble);
    assert(this.bubble === this.blob);
    if (this.outputs.length > 1) {
      // destroy bubble
      bubble.curve.parent.remove(bubble.curve);
      bubble.parent.remove(bubble);
      this.removeOutput(bubble);
      this.updateSinky();
      return;
    }
    bubble.zoom = 1;
    this.el.removeChild(this.blob.el);
    this.bubble = bubble;
    bubble.parent = this;
    this.el.appendChild(bubble.el);
    this.layoutBubble(bubble);

    this.updateSinky();
  }

  removeBubble(bubble) {
    assert(this.bubble === bubble);
    this.bubble = this.blob;
    this.el.appendChild(this.blob.el);
    this.blob.layoutSelf();
    this.layoutBubble(this.bubble);
    this.el.removeChild(bubble.el);

    this.updateSinky();
  }

  reset(arg) {
    if (arg.parent !== this || arg.isLabel) return this;

    var i = this.args.indexOf(arg);
    this.replace(arg, this.inputs[i]);
  };

  detach() {
    if (this.isDoubleTap()) {
      return this.copy();
    }
    if (this.workspace.isPalette) {
      var block = this.copy();
      block.repr.setSink(true);
      return block;
    }
    if (this.parent.isBlock) {
      this.parent.reset(this);
    }
    return this;
  }

  copy() {
    var b = new Block(this.info, this.parts.map(c => c.copy()));
    // TODO init b.inputs correctly
    b.count = this.count;
    return b;
  }

  replaceWith(other) {
    this.parent.replace(this, other);
  }

  moveTo(x, y) {
    super.moveTo(x, y);
    this.moved();
  }

  moved() {
    this.parts.forEach(p => p.moved());
    this.curves.forEach(c => c.layoutSelf());
  }

  get bubbleVisible() {
    return !this.parent.isBlock && !(this.workspace && this.workspace.isPalette);
  }

  objectFromPoint(x, y) {
    if (this.bubble && this.bubbleVisible) {
      var o = this.bubble.objectFromPoint(x - this.bubble.x, y - this.bubble.y)
      if (o) return o;
    }
    for (var i = this.parts.length; i--;) {
      var arg = this.parts[i];
      var o = arg.objectFromPoint(x - arg.x, y - arg.y);
      if (o) return o;
    }
    return opaqueAt(this.context, x * density, y * density) ? this : null;
  }

  get dragObject() {
    return this;
  }

  layoutChildren() {
    this.parts.forEach(c => c.layoutChildren());
    this.bubble.layoutChildren();
    if (this.dirty) {
      this.dirty = false;
    }
    this.layoutSelf();
  }

  drawChildren() {
    this.parts.forEach(c => c.drawChildren());
    this.outputs.forEach(o => o.drawChildren()); // TODO ew
    if (this.graphicsDirty) {
      this.graphicsDirty = false;
      this.draw();
    }
  }

  minDistance(part) {
    if (part.isSwitch) {
      return 16;
    }
    if (part.shape === 'Color') {
      return 10;
    }
    if (part.isBubble) {
      return 0;
    }
    if (part.isBlock) {
      return 6;
    }
    if (part.shape === 'Symbol') {
      return 8;
    }
    return -2 + part.height/2 | 0;
  }

  layoutSelf() {
    var px = 4;

    var lineX = 0;
    var width = 0;
    var height = 28;
    var xs = [0];

    var parts = this.parts;
    var length = parts.length;
    for (var i=0; i<length; i++) {
      var part = parts[i];

      var md = this.minDistance(part);
      if (md && lineX < md - px) { // && first line
        lineX = xs[xs.length - 1] = md - px;
      }
      lineX += part.width;
      width = Math.max(width, lineX + Math.max(0, md - px));
      lineX += 4;
      xs.push(lineX);

      var h = part.height + (part.isBubble ? 0 : 4);
      height = Math.max(height, h);
    }
    width = Math.max(20, width + px * 2);
    this.ownWidth = width;
    this.ownHeight = height;

    for (var i=0; i<length; i++) {
      var part = parts[i];
      var h = part.height;
      var x = px + xs[i];
      var y = (height - h) / 2;
      if (part.isBubble) y -= 2;
      if (part.isLabel) y += 1;
      part.moveTo(x, y);
    }
    this.width = width;
    this.height = height;

    this.layoutBubble(this.bubble);
    this.curves.forEach(c => c.layoutSelf());
    this.redraw();
  }

  layoutBubble(bubble) {
    if (!bubble) return;
    var x = (this.width - bubble.width) / 2;
    var y = this.height - 1;
    bubble.moveTo(x, y);
  }

  pathBlock(context) {
    var w = this.ownWidth;
    var h = this.ownHeight;
    var r = 12;

    context.moveTo(0, r + .5);
    context.arc(r, r + .5, r, PI, PI32, false);
    context.arc(w - r, r + .5, r, PI32, 0, false);
    context.arc(w - r, h - r - .5, r, 0, PI12, false);
    context.arc(r, h - r - .5, r, PI12, PI, false);
  }

  draw() {
    this.canvas.width = this.ownWidth * density;
    this.canvas.height = this.ownHeight * density;
    this.canvas.style.width = this.ownWidth + 'px';
    this.canvas.style.height = this.ownHeight + 'px';
    this.context.scale(density, density);
    this.drawOn(this.context);

    this.bubble.el.style.visibility = this.bubbleVisible ? 'visible' : 'hidden';
  }

  drawOn(context) {
    context.fillStyle = this._color;
    bezel(context, this.pathBlock, this, false, density);
  }

  /* * */

  updateSinky() {
    var isSink = this.outputs.filter(bubble => {
      if (!bubble.parent || !this.parent) return;
      return !bubble.parent.isBlock || (this.bubbleVisible && bubble.parent === this);
    }).length;
    this.repr.setSink(!!isSink);
  }

}



class Source extends Drawable {
  constructor(value) {
    super();
    if (this.constructor === Bubble) return;

    this.el = el('absolute source');
    this.el.appendChild(this.canvas = el('canvas', 'absolute'));
    this.context = this.canvas.getContext('2d');

    this.el.appendChild(this.progress = el('progress absolute'));
    this.el.appendChild(this.elContents = el('result'));

    this.node = Node.input(value);
    this.repr = Node.repr(this.node);
    this.repr.setSink(true);

    this.display(this.repr.value);
    this.repr.onEmit(this.onEmit.bind(this));
    this.repr.onProgress(this.onProgress.bind(this));

    this.outputs = [];
    this.curves = [];
    this.blob = this.bubble = new Blob(this);
    this.el.appendChild(this.blob.el);
  }

  addBubble(bubble) {
    bubble.curve.parent.remove(bubble.curve);
    bubble.parent.remove(bubble);
    this.removeOutput(bubble);
  }

  get isSource() { return true; }
  get isDraggable() { return true; }

  display(value) {
    // TODO ellipsis during progress
    this.elContents.innerHTML = '';
    if (value) this.elContents.appendChild(value.cloneNode(true));
    this.valueWidth = value ? this.elContents.offsetWidth : 0;
    this.valueHeight = value ? this.elContents.offsetHeight : 16;
    this.layout();
  }

  onEmit(value) {
    if (value === null) {
      this.elContents.classList.add('result-invalid');
      return;
    }
    this.elContents.classList.remove('result-invalid');
    this.display(value);
    if (this.fraction === 0) this.fraction = 1;
    this.drawProgress();
    setTimeout(() => {
      this.progress.classList.remove('progress-loading');
    });
  }

  onProgress(e) {
    this.fraction = e.loaded / e.total;
    if (this.fraction < 1) {
      this.progress.classList.add('progress-loading');
    }
    this.drawProgress();
  }

  objectFromPoint(x, y) {
    if (opaqueAt(this.context, x * density, y * density)) return this;
    var o = this.blob.objectFromPoint(x - this.blob.x, y - this.blob.y)
    if (o) return o;
    return null;
  }

  get dragObject() {
    return this;
  }

  detach() {
    if (this.isDoubleTap()) {
      return this.copy();
    }
    if (this.parent.isBlock) {
      this.parent.reset(this);
    }
    return this;
  }

  copy() {
    return new Source(this.node.value);
  }

  layoutChildren() {
    this.blob.layoutChildren();
    this.layoutSelf();
  }

  drawChildren() {
    this.blob.drawChildren();
    this.draw();
  }

  click() {
    super.click();
  }

  layoutSelf() {
    var px = Bubble.paddingX;
    var py = Bubble.paddingY;

    var w = this.valueWidth;
    var h = this.valueHeight;
    this.width = Math.max(Bubble.minWidth, w + 2 * px);
    var t = 0; //Bubble.tipSize // Math.min(, this.width / 2);
    this.height = h + 2 * py + t;
    var x = (this.width - w) / 2;
    var y = t + py + 1;
    this.elContents.style.transform = `translate(${x}px, ${y}px)`;

    this.ownWidth = this.width;
    this.ownHeight = this.height;
    this.layoutBubble(this.blob);
    this.moved();
    this.redraw();
  }

  layoutBubble(bubble) {
    var x = (this.width - bubble.width) / 2;
    var y = this.height - 1;
    bubble.moveTo(x, y);
  }

  pathBubble(context) {
    var w = this.width;
    var h = this.height;
    var r = Bubble.radius;
    var w12 = this.width / 2;

    context.moveTo(1, r + .5);
    context.arc(r + 1, r + .5, r, PI, PI32, false);
    context.arc(w - r - 1, r + .5, r, PI32, 0, false);
    context.arc(w - r - 1, h - r - 1, r, 0, PI12, false);
    context.arc(r + 1, h - r - 1, r, PI12, PI, false);
  }

  draw() {
    this.canvas.width = this.width * density;
    this.canvas.height = this.height * density;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.context.scale(density, density);
    this.drawOn(this.context);

    this.drawProgress();
  }

  drawProgress() {
    var f = this.fraction; //  0.1 + (this.fraction * 0.9);
    var pw = this.width - 2 * Bubble.radius;
    this.progress.style.width = `${f * pw}px`;
  }

  drawOn(context) {
    this.pathBubble(context);
    context.closePath();
    context.fillStyle = this.invalid ? '#aaa' : '#fff';
    context.fill();
    context.strokeStyle = '#555';
    context.lineWidth = density;
    context.stroke();
  }

  pathShadowOn(context) {
    this.pathBubble(context);
    context.closePath();
  }

  moveTo(x, y) {
    super.moveTo(x, y);
    this.moved();
  }

  moved() {
    this.curves.forEach(c => c.layoutSelf());
  }

  updateSinky() {}

  addOutput(output) {
    this.outputs.push(output);
    output.target = this;

    var curve = new Curve(this, output);
    output.curve = curve;
    this.curves.push(curve);

    this.layoutBubble(output);
  }

  removeOutput(output) {
    var index = this.outputs.indexOf(output);
    this.outputs.splice(index, 1);
    output.parent = null;
  }

}



class Bubble extends Source {
  constructor(target) {
    super();

    this.el = el('absolute bubble');
    this.el.appendChild(this.canvas = el('canvas', 'absolute'));
    this.context = this.canvas.getContext('2d');

    this.el.appendChild(this.progress = el('progress absolute'));
    this.el.appendChild(this.elContents = el('result'));

    this.target = target;
    this.curve = null;

    if (target.workspace) target.workspace.add(this);

    this.node = target.node;
    this.display(this.target.repr.value);
    this.target.repr.onEmit(this.onEmit.bind(this));
    this.target.repr.onProgress(this.onProgress.bind(this));
  }

  get isSource() { return false; }
  get isBubble() { return true; }
  get isDraggable() { return true; }

  get parent() { return this._parent; }
  set parent(value) {
    this._parent = value;
    if (this.target) this.target.updateSinky();
  }

  detach() {
    if (this.isDoubleTap()) {
      return new Source(this.node.value);
    }
    if (this.parent.isBlock) {
      if (this.parent.bubble !== this) {
        this.parent.reset(this); // TODO leave our value behind
      }
    }
    return this;
  }

  copy() {
    var r = new Bubble(this.target);
    this.target.addOutput(r);
    return r;
  }

  objectFromPoint(x, y) {
    return opaqueAt(this.context, x * density, y * density) ? this : null;
  }

  replaceWith(other) {
    assert(this.isInside);
    var obj = this.parent;
    obj.replace(this, other);
    if (other === this.target) {
      assert(this.target.bubble.isBlob);
      other.addBubble(this);
      other.layoutChildren();
    }
  }

  click() {
    super.click();
  }

  // moveTo(x, y) {
  //   if (this.parent && !(this.isInside || this.parent.bubble === this)) {
  //     //y = Math.max(y, this.target.y + this.target.ownHeight);
  //   }
  //   super.moveTo(x, y);
  //   this.moved();
  // }

  moved() {
    if (this.curve) this.curve.layoutSelf();
  }

  layoutChildren() {
    // if (this.dirty) {
    //   this.dirty = false;
    this.layoutSelf();
  }

  drawChildren() {
    // if (this.dirty) {
    //   this.dirty = false;
    this.layoutSelf();
  }

  layoutSelf() {
    var px = Bubble.paddingX;
    var py = Bubble.paddingY;

    var w = this.valueWidth;
    var h = this.valueHeight;
    this.width = Math.max(Bubble.minWidth, w + 2 * px);
    var t = Bubble.tipSize // Math.min(, this.width / 2);
    this.height = h + 2 * py + t;
    var x = (this.width - w) / 2;
    var y = t + py + 1;
    this.elContents.style.transform = `translate(${x}px, ${y}px)`;

    this.moved();
    this.redraw();
  }

  pathBubble(context) {
    var t = Bubble.tipSize;
    var w = this.width;
    var h = this.height;
    var r = Bubble.radius;
    var w12 = this.width / 2;

    context.moveTo(1, t + r + .5);
    context.arc(r + 1, t + r + .5, r, PI, PI32, false);
    context.lineTo(w12 - t, t + .5);
    context.lineTo(w12, 1);
    context.lineTo(w12 + t, t + .5);
    context.arc(w - r - 1, t + r + .5, r, PI32, 0, false);
    context.arc(w - r - 1, h - r - 1, r, 0, PI12, false);
    context.arc(r + 1, h - r - 1, r, PI12, PI, false);
  }

  get isInside() {
    return this.parent.isBlock && this.parent.bubble !== this;
  }

}
Bubble.measure = createMetrics('result-label');

Bubble.tipSize = 6;
Bubble.radius = 6;
Bubble.paddingX = 4;
Bubble.paddingY = 2;
Bubble.minWidth = 32; //26;



class Blob extends Drawable {
  constructor(target) {
    super();

    this.el = el('absolute');
    this.el.appendChild(this.canvas = el('canvas', 'absolute'));
    this.context = this.canvas.getContext('2d');

    this.parent = target;
    this.target = target;
    this.setHover(false);
  }

  get isBlob() { return true; }
  get isDraggable() { return true; }

  get color() { return this._color }
  set color(value) {
    this._color = value;
    this.redraw();
  }

  objectFromPoint(x, y) {
    var px = 8;
    var py = 8;
    var touchExtent = {width: this.width + px * 2, height: this.height + py};
    if (containsPoint(touchExtent, x + px, y)) {
      return this;
    }
  }

  setHover(hover) {
    this.color = hover ? '#5B57C5' : '#636284';
  }

  get dragObject() {
    return this;
  }

  detach() {
    var target = this.target;
    var bubble = new Bubble(target);
    target.addOutput(bubble);
    return bubble;
  }

  dragOffset(obj) {
    return {x: -obj.width / 2 + this.width / 2, y: -1};
  }

  replaceWith(other) {
    assert(other.isBubble && other.target === this.target && this.target.bubble === this);
    this.target.addBubble(other);
  }

  layoutSelf() {
    this.width = Blob.radius * 2;
    this.height = Blob.radius * 2;
    this.redraw();
  }

  pathBlob(context) {
    var r = Blob.radius;
    var r2 = r * 2;
    context.moveTo(r, 0);
    context.arc(r, r, r, 0, 2*Math.PI);
  }

  draw() {
    this.canvas.width = this.width * density;
    this.canvas.height = this.height * density;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.canvas.style.left = `${(this.width - this.canvasWidth) / 2}px`;
    this.canvas.style.top = '0px';
    this.context.scale(density, density);
    this.drawOn(this.context);
  }

  drawOn(context) {
    this.pathBlob(context);
    context.closePath();
    context.fillStyle = this.color;
    context.fill();
  }

  pathShadowOn(context) {
    this.pathBlob(context);
    context.closePath();
  }
}
Blob.radius = 6;



class Curve extends Drawable {
  constructor(target, result) {
    assert(target);
    assert(result);
    super();
    this.el = el('absolute curve');
    this.el.appendChild(this.canvas = el('canvas', 'absolute'));
    this.context = this.canvas.getContext('2d');

    this.target = target;
    this.result = result;

    if (target.workspace) target.workspace.add(this);
  }

  get isCurve() { return true; }

  objectFromPoint() {}

  layoutSelf() {
    if (!this.workspace) return;

    var target = this.target;
    var start = this.workspace.positionOf(target);
    start.x += target.width / 2 - 1;
    start.y += target.ownHeight - 2;

    var result = this.result;
    var end = this.workspace.positionOf(result);
    end.x += result.width / 2 - 1;

    var dx = (end.x - start.x + 0.5) | 0;
    var dy = (end.y - start.y + 0.5) | 0;
    if (dx < 0) start.x += dx;
    if (dy < 0) start.y += dy;
    this.moveTo(start.x | 0, start.y | 0);
    this.width = Math.abs(dx) + 2;
    this.height = Math.abs(dy) + 2;
    this.dx = dx;
    this.dy = dy;
    this.draw();
  }

  draw() {
    var w = Math.abs(this.width);
    var h = Math.abs(this.height);
    this.canvas.width = w * density;
    this.canvas.height = h * density;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.context.scale(density, density);
    this.drawOn(this.context);
  }

  drawOn(context) {
    var w = this.width;
    var h = this.height;
    context.save();
    context.translate(this.dx < 0 ? w : 0, this.dy < 0 ? h : 0);
    context.scale(this.dx < 0 ? -1 : +1, this.dy < 0 ? -1 : +1);
    context.beginPath();
    context.moveTo(1, 1);
    context.bezierCurveTo(1, h / 2, w - 1, h / 2, w - 1, h - 1);
    context.lineWidth = density;
    context.strokeStyle = '#555';
    context.stroke();
    context.restore();
  }
}

/*****************************************************************************/

class Workspace {
  constructor() {
    this.elContents = el('absolute');
    this.el = el('workspace no-select');
    this.el.appendChild(this.elContents);

    this.scripts = [];

    this.parent = null;
    this.scrollX = 0;
    this.scrollY = 0;
    this.el.addEventListener('scroll', this.scrolled.bind(this));
  }

  get isWorkspace() { return true; }


  scrolled(e) {
    this.scrollX = this.el.scrollLeft;
    this.scrollY = this.el.scrollTop;
  }

  resize() {
    this.width = this.el.offsetWidth;
    this.height = this.el.offsetHeight;
    // this.el.style.width = width + 'px';
    // this.el.style.height = height + 'px';
    // TODO do something
  }


  objectFromPoint(x, y) {
    x += this.scrollX;
    y += this.scrollY;
    var scripts = this.scripts;
    for (var i=scripts.length; i--;) {
      var script = scripts[i];
      var o = script.objectFromPoint(x - script.x, y - script.y);
      if (o) return o;
    }
    return this;
  }


  // TODO

  layout() {}

  positionOf(obj) {
    if (obj.workspace === this) {
      return obj.workspacePosition;
    }
    var pos = obj.screenPosition;
    return this.worldPositionOf(pos.x, pos.y);
  }

  get screenPosition() {
    var bb = this.el.getBoundingClientRect();
    var x = Math.round(bb.left);
    var y = Math.round(bb.top);
    return {x: x, y: y};
  }
  screenPositionOf(x, y) {
    var pos = this.screenPosition;
    return {x: x + pos.x - this.scrollX, y: y + pos.y - this.scrollY};
  }

  worldPositionOf(x, y) {
    var pos = this.screenPosition;
    return {x: x - pos.x + this.scrollX, y: y - pos.y + this.scrollY};
  }

  add(script) {
    if (script.parent) script.parent.remove(script);
    script.parent = this;
    script.zoom = 1;
    this.scripts.push(script)
    script.layoutChildren();
    script.drawChildren();
    if (script.isCurve) {
      this.elContents.insertBefore(script.el, this.elContents.children[0]);
    } else {
      this.elContents.appendChild(script.el);
    }
    if (script.isBlock && script.bubble && script.bubble.isBubble) {
      this.add(script.bubble.curve);
    }
  }

  remove(script) {
    assert(script.parent === this);
    script.parent = null;
    var index = this.scripts.indexOf(script);
    this.scripts.splice(index, 1);
    this.elContents.removeChild(script.el);
  }
}

/*****************************************************************************/


import {literal, specs} from "./prims";

var colors = {
  ring: '#969696',

  math: '#5cb712',
  text: '#0e9a6c',
  bool: '#e1a91a',
  list: '#cc5b22',
  color: '#8a55d7',
  record: '#c88330',

  sensing: '#2ca5e2',

  variable: '#ee7d16',
  custom: '#632d99',
  arg: '#5947b1',
  //image: '#8a55d7',
  //shape: '#0e9a6c',
  // .sb-motion { fill: #4a6cd4; }
  // .sb-sound { fill: #bb42c3; }
  // events: '#c88330',
  // control: '#e1a91a',
  // .sb-extension { fill: #4b4a60; }
  //
};

var ringBlock;

var paletteContents = [];
specs.forEach(p => {
  let [category, spec, defaults] = p;
  var def = (defaults || []).slice();
  var color = colors[category] || '#555';
  var words = spec.split(/ /g);
  var i = 0;
  var add;
  var addSize;
  var parts = [];
  words.forEach((word, index) => {
    if (word === '%r') {
      parts.push(ringBlock.copy());
    } else if (word === '%b') {
      var value = def.length ? def.shift() : !!(i++ % 2);
      parts.push(new Switch(value));
    } else if (word === '%fields') {
      add = function() {
        return [
          new Input("name", 'Symbol'),
          new Input("", 'Text'),
        ];
      }
      addSize = 2;
    } else if (word === '%exp') {
      add = function() {
        return [new Input(def[this.parts.length - index - 3] || "", 'Text')];
      }
      addSize = 1;
      parts.push(new Input(def.length ? def.shift() : "", 'Text'));
    } else if (word === '%%') {
      parts.push(new Label("%"));
    } else if (/^%/.test(word)) {
      var value = def.length ? def.shift() : word === '%c' ? "#007de0" : "";
      parts.push(new Input(value, {
        '%n': 'Num',
        '%o': 'Record',
        '%l': 'List',
        '%c': 'Color',
        '%m': 'Menu',
        '%q': 'Symbol',
      }[word]));
    } else {
      parts.push(new Label(word));
    }
  });

  var isRing = category === 'ring';
  var b = new Block({spec, color, isRing}, parts);

  if (add) {
    b.count = 1 + def.length;
    def.forEach(value => {
      var obj = new Input(value, 'Text');
      b.add(obj);
      b.inputs.push(obj);
    });
    var delInput = new Arrow("◀", function() {
      if (this === b) return;
      for (var i=0; i<addSize; i++) {
        var arg = this.parts[this.parts.length - 3 - i];
        if (!arg.isInput) return;
      }
      this.count--;
      for (var i=0; i<addSize; i++) {
        this.remove(this.parts[this.parts.length - 3]);
        this.inputs.pop();
      }
      if (this.count === 1) {
        this.remove(this.parts[this.parts.length - 2]);
      }
    });
    if (def.length) b.add(delInput);
    b.add(new Arrow("▶", function() {
      if (this === b) return;
      this.count++;
      if (this.count === 2) {
        this.insert(delInput.copy(), this.parts.length - 1);
      }
      add.call(this).forEach(obj => {
        this.insert(obj, this.parts.length - 2);
        this.inputs.push(obj);
      });
    }));
  }

  if (isRing) {
    ringBlock = b;
    return;
  }
  if (category === 'hidden') {
    return;
  }
  paletteContents.push(b);
});

class Palette extends Workspace {
  constructor() {
    super();
    this.el.className += ' palette';

    var x = 10;
    paletteContents.forEach(o => {
      o.moveTo(x, 8);
      this.add(o);
      x += o.width + 8;
    });
  }

  get isPalette() { return true; }
}

/*****************************************************************************/

class World extends Workspace {
  constructor() {
    super();
    this.el.className += ' world';
    this.elContents.className += ' world-contents';

    this.scrollX = 0;
    this.scrollY = 0;
    this.zoom = 1;
    this.lastX = 0;
    this.lastY = 0;
    this.inertiaX = 0;
    this.inertiaY = 0;
    this.scrolling = false;
    setInterval(this.tick.bind(this), 1000 / 60);
  }

  get isWorld() { return true; }
  get isScrollable() { return true; }

  toScreen(x, y) {
    return {
      x: (x - this.scrollX) * this.zoom,
      y: (y - this.scrollY) * this.zoom,
    };
  };

  fromScreen(x, y) {
    return {
      x: (x / this.zoom) + this.scrollX,
      y: (y / this.zoom) + this.scrollY,
    };
  };

  objectFromPoint(x, y) {
    var pos = this.fromScreen(x, y);
    var scripts = this.scripts;
    for (var i=scripts.length; i--;) {
      var script = scripts[i];
      var o = script.objectFromPoint(pos.x - script.x, pos.y - script.y);
      if (o) return o;
    }
    return this;
  }

  resize() {
    super.resize();
    // TODO re-center
    this.makeBounds();
    this.transform();
  }

  scrollBy(dx, dy) {
    this.scrollX += dx / this.zoom;
    this.scrollY += dy / this.zoom;
    this.makeBounds();
    this.transform();
  }

  fingerScroll(dx, dy) {
    this.scrollBy(-dx, -dy);
    this.scrolling = true;
  }

  fingerScrollEnd() {
    this.scrolling = false;
  }

  tick() {
    if (this.scrolling) {
      this.inertiaX = (this.inertiaX * 4 + (this.scrollX - this.lastX)) / 5;
      this.inertiaY = (this.inertiaY * 4 + (this.scrollY - this.lastY)) / 5;
      this.lastX = this.scrollX;
      this.lastY = this.scrollY;
    } else {
      if (this.inertiaX !== 0 || this.inertiaY !== 0) {
        this.scrollBy(this.inertiaX, this.inertiaY);
        this.inertiaX *= 0.95;
        this.inertiaY *= 0.95;
        if (Math.abs(this.inertiaX) < 0.01) this.inertiaX = 0;
        if (Math.abs(this.inertiaY) < 0.01) this.inertiaY = 0;
      }
    }
  }

  zoomBy(factor, x, y) {
    var oldCursor = this.fromScreen(x, y);
    this.zoom *= factor;
    this.zoom = Math.min(4.0, this.zoom); // zoom <= 4.0
    this.makeBounds();
    var newCursor = this.fromScreen(x, y);
    this.scrollX += oldCursor.x - newCursor.x;
    this.scrollY += oldCursor.y - newCursor.y;
    this.makeBounds();
    this.transform();
  }

  // TODO pinch zoom

  makeBounds() {
    this.bounds = {
      left: this.scrollX - (this.width / 2) / this.zoom + 0.5| 0,
      right: this.scrollX + (this.width / 2) / this.zoom + 0.5| 0,
      bottom: this.scrollY - (this.height / 2) / this.zoom + 0.5 | 0,
      top: this.scrollY + (this.height / 2) / this.zoom + 0.5 | 0,
    };
  }

  transform() {
    this.elContents.style.transform = `scale(${this.zoom}) translate(${-this.scrollX}px, ${-this.scrollY}px)`;
  }

  // TODO

  get screenPosition() {
    return {x: 0, y: 0};
  }

  worldPositionOf(x, y) {
    return this.fromScreen(x, y);
  }

  screenPositionOf(x, y) {
    return this.toScreen(x, y);
  }

}

/*****************************************************************************/

class App {
  constructor() {
    this.el = el('app');
    this.workspaces = [];

    this.world = new World(this.elWorld = el(''));
    this.palette = new Palette(this.elPalette = el(''));
    this.workspaces = [this.world, this.palette];
    this.el.appendChild(this.world.el);
    this.el.appendChild(this.palette.el);

    this.world.app = this; // TODO

    document.body.appendChild(this.el);
    document.body.appendChild(this.elScripts = el('absolute dragging'));

    this.resize();

    this.fingers = [];
    this.feedbackPool = [];
    this.feedback = this.createFeedback();

    document.addEventListener('touchstart', this.touchStart.bind(this));
    document.addEventListener('touchmove', this.touchMove.bind(this));
    document.addEventListener('touchend', this.touchEnd.bind(this));
    document.addEventListener('touchcancel', this.touchEnd.bind(this));
    document.addEventListener('mousedown', this.mouseDown.bind(this));
    document.addEventListener('mousemove', this.mouseMove.bind(this));
    document.addEventListener('mouseup', this.mouseUp.bind(this));
    // TODO pointer events

    window.addEventListener('resize', this.resize.bind(this));
    document.addEventListener('wheel', this.wheel.bind(this));
    document.addEventListener('mousewheel', this.wheel.bind(this));
    document.addEventListener('gesturestart', this.gestureStart.bind(this));
    document.addEventListener('gesturechange', this.gestureChange.bind(this));
    document.addEventListener('gestureend', this.gestureEnd.bind(this));
    // TODO gesture events
  }

  get isApp() { return true; }
  get app() { return this; }

  layout() {}

  resize(e) {
    this.workspaces.forEach(w => w.resize());
  }

  wheel(e) {
    // TODO trackpad should scroll vertically; mouse scroll wheel should zoom!

    var t = e.target;
    do {
      if (t.className === 'result') return;
      t = t.parentNode;
    } while (t);

    var w = this.frameFromPoint(e.clientX, e.clientY);
    if (w) {
      if (e.ctrlKey) {
        if (w.isScrollable) {
          e.preventDefault();
          var factor = Math.pow(1.01, -e.deltaY);
          w.zoomBy(factor, e.clientX, e.clientY);
        }
      } else if (w.isScrollable) {
        e.preventDefault();
        w.scrollBy(e.deltaX, e.deltaY);
      }
    }
  }

  gestureStart(e) {
    e.preventDefault();
    if (isNaN(e.scale)) return;
    var w = this.frameFromPoint(e.clientX, e.clientY);
    if (w) {
      if (w.isScrollable) {
        this.gesture = {
          frame: w,
          lastScale: 1.0,
        };
      }
    }
  }

  gestureChange(e) {
    e.preventDefault();
    if (!this.gesture) return;
    if (isNaN(e.scale) || !isFinite(e.scale)) {
      return;
    }
    var p = this.gesture;
    p.frame.zoomBy(e.scale / p.lastScale, e.clientX, e.clientY);
    p.lastScale = e.scale;
  }

  gestureEnd(e) {
    this.gesture = null;
  }


  mouseDown(e) {
    var p = {clientX: e.clientX, clientY: e.clientY, identifier: this};
    if (!this.startFinger(p, e)) return;
    this.fingerDown(p, e);
  }
  mouseMove(e) {
    var p = {clientX: e.clientX, clientY: e.clientY, identifier: this};
    this.fingerMove(p, e);
  }
  mouseUp(e) {
    var p = {clientX: e.clientX, clientY: e.clientY, identifier: this};
    this.fingerUp(p, e);
  }

  touchStart(e) {
    var touch = e.changedTouches[0];
    var p = {clientX: touch.clientX, clientY: touch.clientY, identifier: touch.identifier};
    if (!this.startFinger(p, e)) return;
    this.fingerDown(p, e);
    for (var i = e.changedTouches.length; i-- > 1;) {
      touch = e.changedTouches[i];
      this.fingerDown({clientX: touch.clientX, clientY: touch.clientY, identifier: touch.identifier}, e);
    }
  }

  touchMove(e) {
    var touch = e.changedTouches[0];
    var p = {clientX: touch.clientX, clientY: touch.clientY, identifier: touch.identifier};
    this.fingerMove(p, e);
    for (var i = e.changedTouches.length; i-- > 1;) {
      var touch = e.changedTouches[i];
      this.fingerMove({clientX: touch.clientX, clientY: touch.clientY, identifier: touch.identifier}, e);
    }
  }

  touchEnd(e) {
    var touch = e.changedTouches[0];
    var p = {clientX: touch.clientX, clientY: touch.clientY, identifier: touch.identifier};
    this.fingerUp(p, e);
    for (var i = e.changedTouches.length; i-- > 1;) {
      var touch = e.changedTouches[i];
      this.fingerUp({clientX: touch.clientX, clientY: touch.clientY, identifier: touch.identifier}, e);
    }
  }

  createFinger(id) {
    if (id === this) {
      var g = this;
    } else {
      this.destroyFinger(id);
      g = this.getFinger(id);
    }
    return g;
  }

  getFinger(id) {
    if (id === this) return this;
    var g = this.fingers[id];
    if (g) return g;
      return this.fingers[id] = {feedback: this.createFeedback()};
  }

  destroyFinger(id) {
    var g = id === this ? this : this.fingers[id];
    if (g) {
      if (g.dragging) this.drop(g); // TODO remove
      this.destroyFeedback(g.feedback);

      // TODO set things
      g.pressed = false;
      g.pressObject = null;
      g.dragging = false;
      g.scrolling = false;
      g.resizing = false;
      g.shouldDrag = false;
      g.dragScript = null;
      if (g.hoverScript) g.hoverScript.setHover(false);
      g.hoverScript = null;

      delete this.fingers[id];
    }
  }

  startFinger(p, e) {
    return true;
  }

  objectFromPoint(x, y) {
    var w = this.workspaceFromPoint(x, y)
    if (!w) return null;
    var pos = w.screenPosition;
    return w.objectFromPoint(x - pos.x, y - pos.y);
  }

  frameFromPoint(x, y) {
    // TODO
    var workspaces = this.workspaces;
    for (var i = workspaces.length; i--;) {
      var w = workspaces[i];
      var pos = w.screenPosition;
      if (containsPoint(w, x - pos.x, y - pos.y)) return w;
    }
    return null;
  }

  workspaceFromPoint(x, y) {
    var workspaces = this.workspaces;
    for (var i = workspaces.length; i--;) {
      var w = workspaces[i];
      var pos = w.screenPosition;
      if (containsPoint(w, x - pos.x, y - pos.y)) return w;
    }
    return null;
  }

  fingerDown(p, e) {
    var g = this.createFinger(p.identifier);
    g.pressX = g.mouseX = p.clientX;
    g.pressY = g.mouseY = p.clientY;
    g.pressObject = this.objectFromPoint(g.pressX, g.pressY);
    g.shouldDrag = false;
    g.shouldScroll = false;

    if (g.pressObject) {
      var leftClick = e.button === 0 || e.button === undefined;
      if (e.button === 2 || leftClick && e.ctrlKey) {
        // right-click
      } else if (leftClick) {
        g.shouldDrag = g.pressObject.isDraggable;
        g.shouldScroll = g.pressObject.isScrollable;
      }
    }

    if (g.shouldDrag || g.shouldScroll) {
      document.activeElement.blur();
      e.preventDefault();
    }

    g.pressed = true;
    g.dragging = false;
    g.scrolling = false;
  }

  fingerMove(p, e) {
    var g = this.getFinger(p.identifier);
    g.mouseX = p.clientX;
    g.mouseY = p.clientY;

    if (g.pressed && g.shouldScroll && !g.scrolling) {
      g.scrolling = true;
      g.scrollX = g.pressX;
      g.scrollY = g.pressY;

    } else if (g.pressed && g.shouldDrag && !g.dragging) {
      this.drop(g);
      var obj = g.pressObject.dragObject;
      var pos = obj.screenPosition;
      g.dragging = true;
      g.dragWorkspace = obj.workspace;
      g.dragX = pos.x - g.pressX;
      g.dragY = pos.y - g.pressY;
      assert(''+g.dragX !== 'NaN');
      g.dragScript = obj.detach();
      if (obj.dragOffset) {
        var offset = obj.dragOffset(g.dragScript);
        g.dragX += offset.x * this.world.zoom;
        g.dragY += offset.y * this.world.zoom;
      }
      if (g.dragScript.parent) {
        g.dragScript.parent.remove(g.dragScript);
      }
      g.dragScript.parent = this;
      g.dragScript.zoom = this.world.zoom;
      this.elScripts.appendChild(g.dragScript.el);
      g.dragScript.layoutChildren();
      g.dragScript.drawChildren();
      // TODO add shadow
    }

    if (g.scrolling || g.dragging) {
      if (g.hoverScript) g.hoverScript.setHover(false);
      g.hoverScript = null;
    }

    if (g.scrolling) {
      g.pressObject.fingerScroll(g.mouseX - g.scrollX, g.mouseY - g.scrollY)
      g.scrollX = g.mouseX;
      g.scrollY = g.mouseY;
      e.preventDefault();
    } else if (g.dragging) {
      g.dragScript.moveTo((g.dragX + g.mouseX), (g.dragY + g.mouseY));
      this.showFeedback(g);
      e.preventDefault();
    } else if (!g.pressed) {
      var obj = this.objectFromPoint(g.mouseX, g.mouseY);
      if (!obj || !obj.setHover) obj = null;
      if (obj !== g.hoverScript) {
        if (g.hoverScript) g.hoverScript.setHover(false);
        g.hoverScript = obj;
        if (g.hoverScript) g.hoverScript.setHover(true);
      }
    }
  }

  fingerUp(p, e) {
    var g = this.getFinger(p.identifier);

    if (g.scrolling) {
      g.pressObject.fingerScrollEnd();
    } else if (g.dragging) {
      this.drop(g);
    } else if (g.shouldDrag || g.shouldResize) {
      g.pressObject.click(g.pressX, g.pressY);
    }

    // TODO

    this.destroyFinger(p.identifier);
  }

  drop(g) {
    if (!g) g = this.getGesture(this);
    if (!g.dragging) return;
    g.feedback.canvas.style.display = 'none';

    if (g.feedbackInfo) {
      var info = g.feedbackInfo;
      info.obj.replaceWith(g.dragScript);
    } else {
      g.dropWorkspace = this.workspaceFromPoint(g.dragX + g.mouseX, g.dragY + g.mouseY) || this.world;
      var d = g.dragScript;
      var canDelete = false;
      if (d.isBlock || d.isSource) {
        canDelete = d.outputs.filter(bubble => {
          return bubble.parent !== d && bubble.parent.isBlock;
        }).length === 0;
      }
      // TODO don't delete if inputs
      if (g.dropWorkspace.isPalette && canDelete) {
        this.remove(d);
        d.outputs.forEach(bubble => {
          if (bubble.parent === this.world) this.world.remove(bubble);
          if (bubble.curve.parent === this.world) this.world.remove(bubble.curve);
        });
      } else {
        g.dropWorkspace = this.world;
        var pos = g.dropWorkspace.worldPositionOf(g.dragX + g.mouseX, g.dragY + g.mouseY);
        g.dropWorkspace.add(d);
        d.moveTo(pos.x, pos.y);
      }
    }

    g.dragging = false;
    g.dragPos = null;
    g.dragState = null;
    g.dragWorkspace = null;
    g.dragScript = null;
    g.dropWorkspace = null;
    g.feedbackInfo = null;
    g.commandScript = null;
  }

  remove(o) {
    this.elScripts.removeChild(o.el);
    // TODO
  }


  createFeedback() {
    if (this.feedbackPool.length) {
      return this.feedbackPool.pop();
    }
    var feedback = el('canvas', 'absolute feedback');
    var feedbackContext = feedback.getContext('2d');
    feedback.style.display = 'none';
    document.body.appendChild(feedback);
    return feedbackContext;
  };

  destroyFeedback(feedback) {
    if (feedback) {
      this.feedbackPool.push(feedback);
    }
  };

  showFeedback(g) {
    g.feedbackDistance = Infinity;
    g.feedbackInfo = null;
    //g.dropWorkspace = null;

    var w = this.workspaceFromPoint(g.mouseX, g.mouseY);
    if (w === this.world) {
      var pos = w.toScreen(0, 0);
      w.scripts.forEach(script => this.addFeedback(g, pos.x, pos.y, script));
    }

    if (g.feedbackInfo) {
      this.renderFeedback(g);
      g.feedback.canvas.style.display = 'block';
    } else {
      g.feedback.canvas.style.display = 'none';
    }
  }

  addFeedback(g, x, y, obj) {
    if (obj.isCurve) return;

    assert(''+x !== 'NaN');
    x += obj.x * this.world.zoom;
    y += obj.y * this.world.zoom;
    if (obj.isBlock) {
      obj.parts.forEach(child => this.addFeedback(g, x, y, child));
      if (obj.bubble.isBlob) {
        this.addFeedback(g, x, y, obj.blob);
      }
    }
    if (obj.isSource) {
      this.addFeedback(g, x, y, obj.blob);
    }

    var gx = g.dragScript.x;
    var gy = g.dragScript.y;
    var canDrop = false;
    if (g.dragScript.isBubble && obj.isBlob && obj.target === g.dragScript.target) {
      gx += g.dragScript.width / 2;
      canDrop = true;
    } else if (obj.isInput || obj.isSwitch) {
      if (g.dragScript.isBlock) {
        canDrop = g.dragScript.outputs.length === 1 && g.dragScript.bubble.isBubble;
      } else if (g.dragScript.isBubble) {
        canDrop = g.dragScript.target !== obj.parent;
      } else {
        canDrop = true;
      }
    } else if (obj.isBubble) {
      if (g.dragScript.isBlock) {
        canDrop = obj.isInside && g.dragScript === obj.target && g.dragScript.outputs.length === 1;
      }
    }

    if (canDrop) {
      var dx = x - gx;
      var dy = y - gy;
      var d2 = dx * dx + dy * dy;
      if (Math.abs(dx) > this.feedbackRange || Math.abs(dy) > this.feedbackRange || d2 > g.feedbackDistance) return;
      g.feedbackDistance = d2;
      g.feedbackInfo = {x, y, obj};
    }
  }

  renderFeedback(g) {
    var feedbackColor = '#ffa';
    var info = g.feedbackInfo;
    var context = g.feedback;
    var canvas = g.feedback.canvas;
    var l = this.feedbackLineWidth;
    var r = l/2;

    var l = 6;
    var x = info.x - l;
    var y = info.y - l;
    var w = info.obj.width * this.world.zoom;
    var h = info.obj.height * this.world.zoom;
    canvas.width = w + l * 2;
    canvas.height = h + l * 2;

    context.translate(l, l);
    var s = this.world.zoom;
    context.scale(s, s);

    info.obj.pathShadowOn(context);

    context.lineWidth = l / 1;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = feedbackColor;
    context.stroke();

    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    info.obj.pathShadowOn(context);
    context.fill();
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = .7;
    context.fillStyle = feedbackColor;
    context.fill();

    canvas.style.transform = 'translate('+x+'px,'+y+'px)';
  }

  get feedbackRange() {
    return 20 * this.world.zoom;
  }

}

window.app = new App();

window.onbeforeunload = e => "AAAAA";

