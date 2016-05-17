
function assert(x) {
  if (!x) throw "Assertion failed!";
}

function isArray(o) {
  return o && o.constructor === Array;
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

  click() {}

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
  constructor(value) {
    super();

    this.el = el('absolute');
    this.el.appendChild(this.canvas = el('canvas', 'absolute'));
    this.context = this.canvas.getContext('2d');

    this.el.appendChild(this.field = el('input', 'absolute field text-field'));

    this.field.addEventListener('input', this.change.bind(this));
    this.field.addEventListener('keydown', this.keyDown.bind(this));

    this.value = value;
  }

  get isInput() { return true; }

  get value() { return this._value; }
  set value(value) {
    this._value = value;
    this.field.value = value;
    this.layout();
  }

  copy() {
    return new Input(this.value);
  }

  replaceWith(other) {
    this.parent.replace(this, other);
  }

  change(e) {
    this._value = this.field.value;
    this.layout();
  }
  keyDown(e) {
    // TODO up-down to change value
  }

  get dragObject() {
    return this.parent.dragObject;
  }

  click() {
    this.field.select();
    this.field.setSelectionRange(0, this.field.value.length);
  }

  acceptsDropOf(b) {
    // TODO
    return this.type !== 't';
  };


  objectFromPoint(x, y) {
    return opaqueAt(this.context, x * density, y * density) ? this : null;
  };

  draw() {
    this.canvas.width = this.width * density;
    this.canvas.height = this.height * density;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.context.scale(density, density);
    this.drawOn(this.context);
  }

  drawOn(context) {
    context.fillStyle = '#fff';
    bezel(context, this.pathFn, this, true, density);
  }

  pathFn(context) {
    var w = this.width;
    var h = this.height;
    var r = 6;

    context.moveTo(0, r + .5);
    context.arc(r, r + .5, r, PI, PI32, false);
    context.arc(w - r, r + .5, r, PI32, 0, false);
    context.arc(w - r, h - r - .5, r, 0, PI12, false);
    context.arc(r, h - r - .5, r, PI12, PI, false);
  }

  layoutSelf() {
    var metrics = Input.measure(this.field.value);
    this.width = Math.max(this.minWidth, metrics.width) + this.fieldPadding * 2;
    this.height = metrics.height + 3;
    this.field.style.width = this.width + 'px';
    this.field.style.height = this.height + 'px';
    this.redraw();
  }

  pathShadowOn(context) {
    this.pathFn(context);
    context.closePath();
  }

}
Input.measure = createMetrics('field');

Input.prototype.minWidth = 6;
Input.prototype.fieldPadding = 4;



class Node extends Drawable {
  constructor(info, parts) {
    super();

    this.el = el('absolute');
    this.el.appendChild(this.canvas = el('canvas', 'absolute'));
    this.context = this.canvas.getContext('2d');

    this.parts = [];
    this.labels = [];
    this.args = [];

    this.info = info;
    for (var i=0; i<parts.length; i++) {
      this.add(parts[i]);
    }

    this.color = '#7a48c3';

    this.outputs = [];
    this.curves = [];
    this.blob = new Blob(this);
    this.bubble = new Bubble(this);
    this.el.appendChild(this.bubble.el);
    this.addOutput(this.bubble);
    this.bubble.parent = this;

    this.value = Math.random() * 200 | 0;
  }

  get isNode() { return true; }
  get isDraggable() { return true; }

  get color() { return this._color }
  set color(value) {
    this._color = value;
    this.redraw();
  }

  add(part) {
    assert(part !== this);
    if (part.parent) part.parent.remove(part);
    part.parent = this;
    part.zoom = 1;
    this.parts.push(part);
    if (this.parent) part.layoutChildren(); // TODO
    this.layout();
    this.el.appendChild(part.el);

    var array = part.isNode || part.isInput ? this.args : this.labels;
    array.push(part);
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

    var array = oldPart.isNode || oldPart.isInput ? this.args : this.labels;
    var index = array.indexOf(oldPart);
    array.splice(index, 1, newPart);

    newPart.layoutChildren();
    newPart.redraw();
    this.layout();
    if (this.workspace) newPart.drawChildren();

    this.el.replaceChild(newPart.el, oldPart.el);
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
    this.el.removeChild(part.el);

    var array = part.isNode ? this.args : this.labels;
    var index = array.indexOf(part);
    array.splice(index, 1);
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
      return;
    }
    bubble.zoom = 1;
    this.el.removeChild(this.blob.el);
    this.bubble = bubble;
    bubble.parent = this;
    this.el.appendChild(bubble.el);
    this.layoutBubble(bubble);
  }

  removeBubble(bubble) {
    assert(this.bubble === bubble);
    this.bubble = this.blob;
    this.el.appendChild(this.blob.el);
    this.blob.layoutSelf();
    this.layoutBubble(this.bubble);
    this.el.removeChild(bubble.el);
  }

  reset(arg) {
    if (arg.parent !== this || !arg.isNode && !arg.isInput) return this;

    var i = this.args.indexOf(arg);
    this.replace(arg, new Input(arg.value));
  };

  detach() {
    if (this.workspace.isPalette) {
      return this.copy();
    }
    if (this.parent.isNode) {
      this.parent.reset(this);
    }
    return this;
  }

  copy() {
    return new Node(this.info, this.parts.map(c => c.copy()));
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
    return !this.parent.isNode && !(this.workspace && this.workspace.isPalette);
  }

  objectFromPoint(x, y) {
    if (this.bubble && this.bubbleVisible) {
      var o = this.bubble.objectFromPoint(x - this.bubble.x, y - this.bubble.y)
      if (o) return o;
    }
    for (var i = this.args.length; i--;) {
      var arg = this.args[i];
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

  layoutSelf() {
    var width = 4;
    var height = 12;
    var xs = [];

    var parts = this.parts;
    var length = parts.length;
    for (var i=0; i<length; i++) {
      var part = parts[i];

      var h = part.height + (part.isBubble ? 0 : 4);
      height = Math.max(height, h);
      xs.push(width);
      width += part.width;
      width += 4;
    }
    //width = Math.max(40, width);
    this.ownWidth = width;
    this.ownHeight = height;

    for (var i=0; i<length; i++) {
      var part = parts[i];
      var h = part.height;
      var x = xs[i];
      var y = (height - h) / 2;
      if (part.isBubble) y -= 2;
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
    var r = 8;

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

  get value() { return this._value }
  set value(value) {
    this._value = value;
    this.outputs.forEach(o => {
      o.value = value;
    });
  }

}



class Bubble extends Drawable {
  constructor(target) {
    super();

    this.el = el('absolute');
    this.el.appendChild(this.canvas = el('canvas', 'absolute'));
    this.context = this.canvas.getContext('2d');

    this.target = target;
    this.curve = null;
    this.label = new Label("", 'result-label');
    this.value = target.value;
    this.el.appendChild(this.label.el);

    if (target.workspace) target.workspace.add(this);
  }

  get value() { return this._value }
  set value(value) {
    this._value = value;
    this.label.text = value;
    //this.redraw();
  }

  get isBubble() { return true; }
  get isDraggable() { return true; }

  objectFromPoint(x, y) {
    return opaqueAt(this.context, x * density, y * density) ? this : null;
  }

  get dragObject() {
    return this;
  }

  detach() {
    if (this.parent.isNode) {
      if (this.parent.bubble !== this) {
        this.parent.replace(this, new Input(this.value));
      }
    }
    return this;
  }

  copy() {
    var r = new Bubble(this.target);
    this.target.addOutput(r);
    return r;
  }

  replaceWith(other) {
    assert(this.parent.isNode);
    this.parent.replace(this, other);
  }

  click() {
    console.log('click result');
  }

  moveTo(x, y) {
    super.moveTo(x, y);
    this.moved();
  }

  moved() {
    if (this.curve) this.curve.layoutSelf();
  }

  layoutSelf() {
    var px = Bubble.paddingX
    var py = Bubble.paddingY;
    this.width = Math.max(Bubble.minWidth, this.label.width + 2 * px);
    var t = Bubble.tipSize // Math.min(, this.width / 2);
    this.height = this.label.height + 2 * py + t;
    var x = (this.width - this.label.width) / 2;
    var y = t + py;
    this.label.moveTo(x, y);
    this.redraw();
  }

  pathBubble(context) {
    var t = this.isInside ? Bubble.tipSize : 4;
    var w = this.width;
    var h = this.height;
    var r = 6;
    var w12 = this.width / 2;

    context.moveTo(1, t + r + .5);
    context.arc(r + 1, t + r + .5, r, PI, PI32, false);
    context.lineTo(w12 - t, t + .5);
    context.lineTo(w12, 1);
    context.lineTo(w12 + t, t + .5);
    context.arc(w - r - 1, t + r + .5, r, PI32, 0, false);
    context.arc(w - r - 1, h - r - .5, r, 0, PI12, false);
    context.arc(r + 1, h - r - .5, r, PI12, PI, false);
  }

  draw() {
    this.canvas.width = this.width * density;
    this.canvas.height = this.height * density;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.context.scale(density, density);
    this.drawOn(this.context);
  }

  get isInside() {
    return this.parent.isNode && this.parent.bubble !== this;
  }

  drawOn(context) {
    if (this.isInside) {
      context.fillStyle = '#fff';
      bezel(context, this.pathBubble, this, true, density);
    } else {
      console.log(this.parent, this.parent.bubble);
      this.pathBubble(context);
      context.closePath();
      context.fillStyle = '#fff';
      context.fill();
      context.strokeStyle = '#555';
      context.lineWidth = density;
      context.stroke();
    }
  }
}

Bubble.tipSize = 6;
Bubble.paddingX = 2;
Bubble.paddingY = 1;
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
    context.lineTo(r2, r);
    context.lineTo(r, r2);
    context.lineTo(0, r);
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
    if (script.isNode && script.bubble && script.bubble.isBubble) {
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

import {primitives} from "./runtime";

var paletteContents = primitives.map(function(prim) {
  if (typeof prim === 'string') return;
  let [spec, type, js] = prim;
  var words = spec.split(/ |(_[a-z]*:\([^)]+\))/g).filter(x => x);
  var parts = words.map(word => {
    if (/:|^_/.test(word)) {
      var value = /Float/.test(word) ? "0.0" :
                  /Int/.test(word) ? "10" :
                  /Str/.test(word) ? "hello" : "";
      return new Input(value)
    } else {
      return new Label(word);
    }
  });
  return new Node({}, parts);
}).filter(x => !!x);



class Palette extends Workspace {
  constructor() {
    super();
    this.el.className += ' palette';

    var x = 0;
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
    this.factor = 1;
    this.zoom = 1;
    this.lastX = 0;
    this.lastY = 0;
    this.inertiaX = 0;
    this.inertiaY = 0;
    this.scrolling = false;
    setInterval(this.tick.bind(this), 1 / 60);


    // TODO
    /*
    this.add(new Node({}, [
      new Label("bob"),
      new Node({}, [
        new Label("cow"),
      ]),
      new Label("fred"),
    ]));

    var o;
    this.add(o = new Node({}, [
      new Label("go"),
      new Input("123"),
      new Label("house"),
      new Input("party"),
    ]));
    o.moveTo(0, 50);

    this.add(o = new Node({}, [
      new Label("quxx"),
      new Node({}, [
        new Label("wilfred"),
        new Input("man"),
        new Label("has"),
        new Node({}, [
          new Label("burb"),
        ]),
      ]),
    ]));
    o.moveTo(100, 20);
    */

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

  zoomBy(delta, x, y) {
    this.factor -= delta;
    this.factor = Math.min(139, this.factor); // zoom <= 4.0
    var oldCursor = this.fromScreen(x, y);
    this.zoom = Math.pow(1.01, this.factor);
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

    window.addEventListener('resize', this.resize.bind(this));
    document.addEventListener('wheel', this.wheel.bind(this));
    document.addEventListener('mousewheel', this.wheel.bind(this));
  }

  get isApp() { return true; }
  get app() { return this; }

  resize(e) {
    this.workspaces.forEach(w => w.resize());
  }

  wheel(e) {
    // TODO trackpad should scroll vertically; mouse scroll wheel should zoom!
    // TODO Safari 9.1 has *actual* gesture events: gestureDown/Change/Up to zoom
    var w = this.workspaceFromPoint(e.clientX, e.clientY);
    if (w) {
      if (e.ctrlKey) {
        if (w.isScrollable) {
          e.preventDefault();
          w.zoomBy(e.deltaY, e.clientX, e.clientY);
        }
      } else if (w.isScrollable) {
        e.preventDefault();
        w.scrollBy(e.deltaX, e.deltaY);
      }
    }
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
    console.log('pressed', g.pressObject);
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
      if (!obj.setHover) obj = null;
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

    // TODO
    g.dropWorkspace = this.world; // TODO
    var pos = g.dropWorkspace.worldPositionOf(g.dragX + g.mouseX, g.dragY + g.mouseY);
    if (g.feedbackInfo) {
      var info = g.feedbackInfo;
      info.node.replaceWith(g.dragScript);
    } else {
      g.dropWorkspace.add(g.dragScript);
      g.dragScript.moveTo(pos.x, pos.y);
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

  addFeedback(g, x, y, node) {
    assert(''+x !== 'NaN');
    x += node.x * this.world.zoom;
    y += node.y * this.world.zoom;
    if (node.isNode) {
      node.parts.forEach(child => this.addFeedback(g, x, y, child));
      if (node.bubble.isBlob) {
        this.addFeedback(g, x, y, node.blob); // + node.ownWidth / 2, y + node.ownHeight / 2, node.blob)
      }
    }

    var canDrop = (
      (node.isInput && g.dragScript.target !== node.parent) ||
      (g.dragScript.isBubble && node.isBlob && node.target === g.dragScript.target)
    );

    if (canDrop) {
      var dx = x - g.dragScript.x;
      var dy = y - g.dragScript.y;
      var d2 = dx * dx + dy * dy;
      if (Math.abs(dx) > this.feedbackRange || Math.abs(dy) > this.feedbackRange || d2 > g.feedbackDistance) return;
      g.feedbackDistance = d2;
      g.feedbackInfo = {x, y, node};
    }
  }

  renderFeedback(g) {
    var feedbackColor = '#fff';
    var info = g.feedbackInfo;
    var context = g.feedback;
    var canvas = g.feedback.canvas;
    var l = this.feedbackLineWidth;
    var r = l/2;

    var l = 2;
    var x = info.x - l;
    var y = info.y - l;
    var w = info.node.width * this.world.zoom;
    var h = info.node.height * this.world.zoom;
    canvas.width = w + l * 2;
    canvas.height = h + l * 2;

    context.translate(l, l);
    var s = this.world.zoom;
    context.scale(s, s);

    info.node.pathShadowOn(context);

    context.lineWidth = l / 1;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = feedbackColor;
    context.stroke();

    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    info.node.pathShadowOn(context);
    context.fill();
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = .6;
    context.fillStyle = feedbackColor;
    context.fill();

    canvas.style.transform = 'translate('+x+'px,'+y+'px)';
  }

  get feedbackRange() {
    return 20 * this.world.zoom;
  }

}

window.app = new App();

