
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

  get value() {
    return literal(this._value);
  }
  set value(value) {
    value = ''+value;
    this._value = value;
    this.field.value = value;
    this.layout();
  }

  change(e) {
    this._value = this.field.value;
    this.layout();
    this.parent.invalidate();
    assert(this.parent);
  };
  keyDown(e) {
    // TODO up-down to change value
  }

  get dragObject() {
    return this.parent.dragObject;
  }

  copy() {
    return new Input(this._value);
  }

  replaceWith(other) {
    this.parent.replace(this, other);
  }

  click() {
    this.field.select();
    this.field.setSelectionRange(0, this.field.value.length);
  }

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
    context.fillStyle = '#f7f7f7';
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

Input.prototype.minWidth = 12;
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

    this.initValue();

    this.info = info;
    for (var i=0; i<parts.length; i++) {
      this.add(parts[i]);
    }

    this.color = info.color; //'#7a48c3';

    this.outputs = [];
    this.curves = [];
    this.blob = new Blob(this);
    this.bubble = new Bubble(this);
    this.el.appendChild(this.bubble.el);
    this.addOutput(this.bubble);
    this.bubble.parent = this;

    this.invalidate();
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

    var array = part.isLabel ? this.labels : this.args;
    array.push(part);

    var node = part.target || part;
    if (node && node.isNode) {
      node.request(this);
    }
    this.invalidate();
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

    
    var node = oldPart.target || oldPart;
    if (node && node.isNode) {
      node.cancelRequest(this);
    }
    var node = newPart.target || newPart;
    if (node && node.isNode) {
      node.request(this);
    }
    this.invalidate();
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

    var array = part.isLabel ? this.labels : this.args;
    var index = array.indexOf(part);
    array.splice(index, 1);

    var node = part.target || part;
    if (node && node.isNode) {
      node.cancelRequest(this);
    }
    this.invalidate();
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
    this.replace(arg, new Input(arg.isInput ? arg.value : arg.displayValue));
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

  initValue() {
    this._invalid = true;
    this.requests = new Set();
  }

  get value() { return this._value }
  set value(value) {
    this._value = value;
    if (this.parent && this.parent.isNode) {
      this.parent.invalidate();
    } else {
      this.outputs.forEach(o => {
        o.value = value;
      });
    }
  }

  invalidate() {
    if (!this.outputs) return; // wait for init to finish
    this._invalid = true;
    if (this.value) this.value.cancel();
    this.value = null;
    if (this.parent && this.parent.isNode) {
      this.parent.invalidate();
    } else {
      this.outputs.forEach(o => o.invalidate());
    }
    if (this.needed) {
      this.evaluate();
    }
  }

  request(who) {
    this.requests.add(who);
    this.needed = !!this.requests.size;
  }

  cancelRequest(who) {
    this.requests.delete(who);
    this.needed = !!this.requests.size;
    // TODO cancel in-progress evaluation
  }

  get needed() { return this._needed }
  set needed(needed) {
    this._needed = needed;
    if (needed) {
      if (this._invalid) this.evaluate();
    } else {
      this.value.cancel();
    }

    this.args.forEach(arg => {
      var node = arg.target || arg;
      if (node.isNode) {
        needed ? node.request() : node.cancelRequest();
      }
    });
  }

  evaluate() {
    if (this.info.isRing) {
      var f = this.value = new Future;
      var arg = this.args[0];
      if (arg.isBubble) {
        f.error("Ring can't accept bubble");
      } else if (!arg.isNode) {
        f.load(null);
      } else {
        f.load(arg.asRing());
      }
      return;
    }
    if (this.value) this.value.cancel();
    var args = this.args.map(x => {
      if (x.value && x.value.isFuture) return x.value;
      var f = new Future;
      f.load(x.value);
      return f;
    });
    this.value = evaluate(this.info, args);
  }

  asRing() {
    var args = this.args.map(x => {
      if (x.isInput && x.value === "") return "";
      if (x.value && x.value.isFuture) return x.value;
      var f = new Future;
      f.load(x.value);
      return f;
    });
    return input => {
      var instance = args.slice();
      var index = args.indexOf("");
      while (index !== -1) {
        instance[index] = input;
        index = instance.indexOf("");
      }
      return evaluate(this.info, instance);
    };
  }
}



class Bubble extends Drawable {
  constructor(target) {
    super();

    this.el = el('absolute bubble');
    this.el.appendChild(this.canvas = el('canvas', 'absolute'));
    this.context = this.canvas.getContext('2d');

    this.el.appendChild(this.progress = el('progress absolute'));
    // this.progress.style.left = `${Bubble.radius}px`;
    // this.progress.style.top = `${Bubble.tipSize}px`;

    this.target = target;
    this.curve = null;
    this.label = new Label("", 'result-label');
    this.value = target.value;
    this.el.appendChild(this.label.el);

    if (target.workspace) target.workspace.add(this);

    target.request(this);
  }

  get isBubble() { return true; }
  get isDraggable() { return true; }

  get parent() { return this._parent }
  set parent(p) {
    this._parent = p;
    if (p) {
      var isSink = !this.parent.isNode || this.target.bubble === this;
      if (isSink && !(this.workspace && this.workspace.isPalette)) {
        this.target.request(this);
      } else {
        this.target.cancelRequest(this);
      }
    }
  }

  get value() { return this._value }
  set value(value) {
    this._value = value;
    this.invalid = false;
    this.fraction = 0;
    this.el.classList.remove('error');
    this.progress.classList.remove('progress-error');
    this.progress.classList.add('progress-loading');
    if (value) this.bindEvents(value);

    if (this.parent && this.isInside) {
      this.parent.invalidate();
    }
  }

  bindEvents(future) {
    this.value.withLoad(result => {
      assert(this.value === future);
      var repr = display(result);
      this.label.text = repr;
      if (this.fraction === 0) this.fraction = 1;
      this.drawProgress();
      setTimeout(() => {
        this.progress.classList.remove('progress-loading');
      });
      this.layout();
    });
    this.value.withError(err => {
      assert(this.value === future);
      this.label.text = err.message || err;
      this.el.classList.add('error');
      this.progress.classList.add('progress-error');
      this.layout();
    });
    this.value.onProgress(p => {
      assert(this.value === future);
      this.fraction = p.loaded / p.total;
      if (this.fraction < 1) {
        this.progress.classList.add('progress-loading');
      }
      this.drawProgress();
    });

    /*
    var repr = display(value);
    this._isLabel = typeof repr === 'string';
    if (typeof repr === 'string') {
      this.label.text = repr;
      this.el.appendChild(this.label.el);
    } else {
      this.el.innerHTML = '';
      this.el.appendChild(repr);
    }
    */

    this.layout();
  }

  get invalid() { return this._invalid }
  set invalid(value) {
    this._invalid = value;
    this.el.classList[value ? 'add' : 'remove']('invalid');
    this.redraw();
  }

  invalidate() {
    this.invalid = true;
    if (this.parent && this.isInside) {
      this.parent.invalidate();
    }
  }

  get displayValue() {
    var value = "";
    if (this.value) {
      var repr = this.value.result;
      if (repr && this.value.isDone && typeof repr === 'string') {
        value = repr;
        assert(value !== '[object Object]');
      }
    }
    return value;
  }

  objectFromPoint(x, y) {
    return opaqueAt(this.context, x * density, y * density) ? this : null;
  }

  get dragObject() {
    return this;
  }

  detach() {
    if (this.parent.isNode) {
      if (this.parent.bubble !== this) {
        // TODO literal images etc
        this.parent.replace(this, new Input(this.displayValue));
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
    assert(this.isInside);
    var node = this.parent;
    node.replace(this, other);
    if (other === this.target) {
      assert(this.target.bubble.isBlob);
      other.addBubble(this);
      other.layoutChildren();
    }
  }

  click() {
    console.log('click result');
  }

  moveTo(x, y) {
    if (this.parent && !(this.isInside || this.parent.bubble === this)) {
      //y = Math.max(y, this.target.y + this.target.ownHeight);
    }
    super.moveTo(x, y);
    this.moved();
  }

  moved() {
    if (this.curve) this.curve.layoutSelf();
  }

  layoutSelf() {
    var px = Bubble.paddingX;
    var py = Bubble.paddingY;

    // TODO layout custom dom things
    var metrics = Bubble.measure(this.label.text);

    var w = Math.min(512, metrics.width);
    var h = Math.min(256, metrics.height);
    this.label.el.style.width = `${w}px`;
    this.label.el.style.height = `${h}px`;

    this.width = Math.max(Bubble.minWidth, w + 2 * px);
    var t = Bubble.tipSize // Math.min(, this.width / 2);
    this.height = h + 2 * py + t;
    var x = (this.width - w) / 2;
    var y = t + py + 1;
    this.label.moveTo(x, y);

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

    this.drawProgress();
  }

  drawProgress() {
    var f = this.fraction; //  0.1 + (this.fraction * 0.9);
    var pw = this.width - 2 * Bubble.radius;
    this.progress.style.width = `${f * pw}px`;
  }

  get isInside() {
    return this.parent.isNode && this.parent.bubble !== this;
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
import {literal, display, evaluate, Future} from "./runtime";

var colors = {
  ring: '#969696',
  math: '#5cb712',
  ops: '#5cb712',
  str: '#5cb712',
  sensing: '#2ca5e2',
  list: '#cc5b22',
  variable: '#ee7d16',
  custom: '#632d99',
  arg: '#5947b1',
  image: '#8a55d7',
  shape: '#0e9a6c',
  // .sb-motion { fill: #4a6cd4; }
  // .sb-sound { fill: #bb42c3; }
  // .sb-events { fill: #c88330; }
  // .sb-control { fill: #e1a91a; }
  // .sb-extension { fill: #4b4a60; }
};

var paletteContents = [];
primitives.forEach(p => {
  let [spec, category, prim] = p;
  var color = colors[category] || '#555';
  var words = spec.split(/ /g);
  var parts = words.map(word => {
    if (word === '_ring') {
      return paletteContents[0].copy();
    } else if (/^_/.test(word)) {
      var value = word.slice(1);
      return new Input(value)
    } else {
      return new Label(word);
    }
  });
  var isRing = prim.isRing;
  paletteContents.push(new Node({prim, color, isRing}, parts));
});

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
    // TODO pointer events

    window.addEventListener('resize', this.resize.bind(this));
    document.addEventListener('wheel', this.wheel.bind(this));
    document.addEventListener('mousewheel', this.wheel.bind(this));
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

    if (e.target.className.split(/ /g).indexOf('result-label') !== -1) {
      return;
    }

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

    if (g.feedbackInfo) {
      var info = g.feedbackInfo;
      info.node.replaceWith(g.dragScript);
    } else {
      g.dropWorkspace = this.workspaceFromPoint(g.dragX + g.mouseX, g.dragY + g.mouseY) || this.world;
      if (g.dropWorkspace.isWorld) {
        var pos = g.dropWorkspace.worldPositionOf(g.dragX + g.mouseX, g.dragY + g.mouseY);
        g.dropWorkspace.add(g.dragScript);
        g.dragScript.moveTo(pos.x, pos.y);
      } else {
        this.remove(g.dragScript);
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

  addFeedback(g, x, y, node) {
    if (node.isCurve) return;

    assert(''+x !== 'NaN');
    x += node.x * this.world.zoom;
    y += node.y * this.world.zoom;
    if (node.isNode) {
      node.parts.forEach(child => this.addFeedback(g, x, y, child));
      if (node.bubble.isBlob) {
        this.addFeedback(g, x, y, node.blob); // + node.ownWidth / 2, y + node.ownHeight / 2, node.blob)
      }
    }

    var canDrop = false;
    if (g.dragScript.isBubble && node.isBlob && node.target === g.dragScript.target) {
      canDrop = true;
    } else if (node.isInput) {
      if (g.dragScript.isNode) {
        canDrop = g.dragScript.outputs.length === 1 && g.dragScript.bubble.isBubble;
      } else if (g.dragScript.isBubble) {
        canDrop = g.dragScript.target !== node.parent;
      } else {
        canDrop = true;
      }
    } else if (node.isBubble) {
      if (g.dragScript.isNode) {
        canDrop = node.isInside && g.dragScript === node.target && g.dragScript.outputs.length === 1;
      }
    }

    var gx = g.dragScript.x;
    var gy = g.dragScript.y;
    gx += g.dragScript.width / 2;

    if (canDrop) {
      var dx = x - gx;
      var dy = y - gy;
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

