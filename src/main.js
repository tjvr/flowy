
function assert(x) {
  if (!x) throw "Assertion failed!";
}

function extendr(o, properties) {
  for (var k in properties) if (hasOwnProperty.call(properties, k)) {
    var v = properties[k];
    if (typeof v === 'object') {
      extendr(o[k], v);
    } else {
      o[k] = v;
    }
  }
  return o;
}

class Vec {
  constructor(x, y) {
    if (x && x.x !== undefined) { y = x.y; x = x.x; }
    this.x = x || 0;
    this.y = y || 0;
  };

  add(dx, dy) {
    var delta = new Vec(dx, dy);
    return new Vec(this.x + delta.x, this.y + delta.y);
  };

  sub(dx, dy) {
    var delta = new Vec(dx, dy);
    return new Vec(this.x - delta.x, this.y - delta.y);
  };
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
    this.workspace = true; // TODO
  }

  moveTo(x, y) {
    this.x = x | 0;
    this.y = y | 0;
    this.el.style.transform = `translate(${x}px, ${y}px)`;
  }

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

      // for debugging
      this.el.style.width = this.width;
      this.el.style.height = this.height;
    } else {
      this.graphicsDirty = true;
    }
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

  get workspacePosition() {
    var o = this;
    var x = 0;
    var y = 0;
    while (o && !o.isWorkspace) {
      x += o.x;
      y += o.y;
      o = o.parent;
    }
    return {x: x, y: y};
  }

  get worldPosition() {
    var o = this;
    var x = 0;
    var y = 0;
    while (o && !o.isWorkspace) {
      x += o.x;
      y += o.y;
      o = o.parent;
    }
    /*
    if (o) {
      x *= 1; // o._scale;
      y *= 1; // o._scale;
      var bb = o.el.getBoundingClientRect();
      x += Math.round(bb.left);
      y += Math.round(bb.top);
      if (o.el !== document.body) {
        // x -= o.scrollX;
        // y -= o.scrollY;
      }
    }
    */
    return {x: x, y: y};
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

  get value() { return this._value; }
  set value(value) {
    this._value = value;
    this.field.value = value;
    this.layout();
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
    var r = 4;

    context.moveTo(0, r + .5);
    context.arc(r, r + .5, r, PI, PI32, false);
    context.arc(w - r, r + .5, r, PI32, 0, false);
    context.arc(w - r, h - r - .5, r, 0, PI12, false);
    context.arc(r, h - r - .5, r, PI12, PI, false);
  }

  layoutSelf() {
    var metrics = Input.measure(this.field.value);
    this.width = Math.max(this.minWidth, metrics.width) + this.fieldPadding * 2;
    this.height = metrics.height + 1;
    this.field.style.width = this.width + 'px';
    this.field.style.height = this.height + 'px';
    this.redraw();
  }

}
Input.prototype.isInput = true;
Input.measure = createMetrics('field');

Input.prototype.minWidth = 6;
Input.prototype.fieldPadding = 4;



class Operator extends Drawable {
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

    this.output = new Result("3.14");
    this.output.parent = this;
    this.el.appendChild(this.output.el);
  }

  get color() { return this._color }
  set color(value) {
    this._color = value;
    this.redraw();
  }

  add(part) {
    if (part.parent) part.parent.remove(part);
    part.parent = this;
    this.parts.push(part);
    if (this.parent) part.layoutChildren(); // TODO
    this.layout();
    this.el.appendChild(part.el);

    var array = part.isOperator || part.isInput ? this.args : this.labels;
    array.push(part);
  }

  replace(oldPart, newPart) {
    if (oldPart.parent !== this) return;
    if (newPart.parent) newPart.parent.remove(newPart);
    oldPart.parent = null;
    newPart.parent = this;

    var index = this.parts.indexOf(oldPart);
    this.parts.splice(index, 1, newPart);

    var array = oldPart.isOperator || part.isInput  ? this.args : this.labels;
    var index = array.indexOf(oldPart);
    array.splice(index, 1, newPart);

    newPart.layoutChildren();
    this.layout();
    if (this.workspace) newPart.drawChildren();

    this.el.replaceChild(newPart.el, oldPart.el);
  };

  remove(part) {
    if (part.parent !== this) return;
    part.parent = null;
    var index = this.parts.indexOf(part);
    this.parts.splice(index, 1);
    this.el.removeChild(part.el);

    var array = part.isOperator ? this.args : this.labels;
    var index = array.indexOf(part);
    array.splice(index, 1);
  }

  reset(arg) {
    if (arg.parent !== this || !arg.isOperator && !arg.isInput) return this;

    var i = this.args.indexOf(arg);
    this.replace(arg, new Input("123"));
  };

  detach() {
    if (this.workspace.isPalette) {
      return this.copy();
    }
    if (this.parent.isOperator) {
      this.parent.reset(this);
      // return this; //new Script().setScale(this._scale).add(this);
    }
    this.redraw();
    return this;
    // if (this.parent.isScript) {
    //   return this.parent.splitAt(this);
    // }
  }

  objectFromPoint(x, y) {
    var args = this.args;
    for (var i = args.length; i--;) {
      var arg = args[i];
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
    if (this.output) this.output.layoutChildren();
    if (this.dirty) {
      this.dirty = false;
      this.layoutSelf();
    }
  }

  drawChildren() {
    this.parts.forEach(c => c.drawChildren());
    if (this.output) this.output.drawChildren();
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

      height = Math.max(height, part.height + 4);
      xs.push(width);
      width += part.width;
      width += 4;
    }
    //width = Math.max(40, width);
    this.ownWidth = width;
    this.ownHeight = height;

    for (var i=0; i<length; i++) {
      var part = parts[i];
      var x = xs[i];
      var y = (height - part.height) / 2;
      part.moveTo(x, y);
    }

    if (this.output) {
      var x = (width - this.output.width) / 2;
      this.output.moveTo(x, height - 1);
    }
    this.width = width;
    this.height = height;

    this.redraw();
  }

  pathBlock(context) {
    var w = this.ownWidth;
    var h = this.ownHeight;
    var r = 6;

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
    if (this.output) {
      this.output.el.style.visibility = this.parent && this.parent.isOperator ? 'hidden' : 'visible';
    }
  }

  drawOn(context) {
    context.fillStyle = this._color;
    bezel(context, this.pathBlock, this, false, density);
  }
}
Operator.prototype.isOperator = true;

Operator.prototype.isDraggable = true;



class Result extends Drawable {
  constructor(value) {
    super();

    this.el = el('absolute');
    this.el.appendChild(this.canvas = el('canvas', 'absolute'));
    this.context = this.canvas.getContext('2d');

    this.value = value;
    this.label = new Label(value, 'result-label');
    this.el.appendChild(this.label.el);
  }

  objectFromPoint(x, y) {
    return opaqueAt(this.context, x * density, y * density) ? this : null;
  }

  get dragObject() {
    return this;
  }

  detach() {
    return this; // TODO
  }

  layoutSelf() {
    var p2 = Result.padding * 2;
    this.width = Math.max(64, this.label.width + p2);
    this.height = this.label.height + Result.tipSize + p2;
    var x = (this.width - this.label.width) / 2;
    var y = Result.tipSize + Result.padding;
    this.label.moveTo(x, y);
    this.redraw();
  }

  pathBubble(context) {
    var w = this.width;
    var h = this.height;
    var r = 6;
    var t = Result.tipSize;
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

  drawOn(context) {
    this.pathBubble(context);
    context.closePath();
    context.fillStyle = '#fff';
    context.fill();
    context.strokeStyle = '#555';
    context.lineWidth = `$(density * 2)px`;
    context.stroke();
  }

}
Result.prototype.isResult = true;

Result.prototype.isDraggable = true;

Result.tipSize = 8;
Result.padding = 6;


/*****************************************************************************/

class Camera {
  constructor(width, height) {
    this.pos = new Vec();
    this.width;
    this.height;
    this.zoom = 1;

    this.update();
  }

  update() {
    this.left = this.pos.x - (this.width / 2) / this.zoom;
    this.right = this.pos.x + (this.width / 2) / this.zoom;
    this.bottom = this.pos.y - (this.height / 2) / this.zoom;
    this.top = this.pos.y + (this.height / 2) / this.zoom;
  };

  toScreen(x, y) {
    var point = new Vec(x, y);
    return new Vec(
      (point.x - this.left) * this.zoom,
      (this.top - point.y) * this.zoom
    );
  };

  fromScreen(x, y) {
    var screen = new Vec(x, y);
    return new Vec(
      (screen.x / this.zoom) + this.left,
      -((screen.y / this.zoom) - this.top)
    );
  };
}

class World {
  constructor() {
    this.camera = new Camera();
    this.factor = 1;
    this.el = this.elContents = el('world no-select');

    this.scripts = [];

    window.addEventListener('resize', this.resize.bind(this));
    window.addEventListener('wheel', this.wheel.bind(this));
    window.addEventListener('mousewheel', this.wheel.bind(this));

    this.lastTouch;
    this.lastDelta;
    this.inertia = new Vec(0, 0);

    window.addEventListener('touchstart', this.touchDown.bind(this));
    window.addEventListener('touchmove', this.touchMove.bind(this));
    window.addEventListener('touchend', this.touchUp.bind(this));
    window.addEventListener('touchcancel', this.touchUp.bind(this));

    this.resize();
    this.tick();

    this.fingers = [];
    window.addEventListener('mousedown', this.mouseDown.bind(this));
    window.addEventListener('mousemove', this.mouseMove.bind(this));
    window.addEventListener('mouseup', this.mouseUp.bind(this));

    this.add(new Operator({}, [
      new Label("bob"),
      new Operator({}, [
        new Label("cow"),
      ]),
      new Label("fred"),
    ]));

    var o;
    this.add(o = new Operator({}, [
      new Label("go"),
      new Input("123"),
      new Label("house"),
      new Input("party"),
    ]));
    o.moveTo(0, 50);

    this.add(o = new Operator({}, [
      new Label("quxx"),
      new Operator({}, [
        new Label("wilfred"),
        new Input("man"),
        new Label("has"),
        new Operator({}, [
          new Label("burb"),
        ]),
      ]),
    ]));
    o.moveTo(100, 20);

    this.add(o = new Result("pizza!"));
    o.moveTo(-100, 100);
  }

  layout() {}

  add(script) {
    if (script.parent) script.parent.remove(script);
    script.parent = this;
    this.scripts.push(script)
    script.layoutChildren();
    script.drawChildren();
    this.elContents.appendChild(script.el);
  }

  remove() {}

  grab(script, offsetX, offsetY, g) {
    if (!g) g = this.createGesture(this);
    this.drop(g);
    g.dragging = true;

    if (offsetX === undefined) {
      var pos = script.worldPosition;
      offsetX = pos.x - g.pressX;
      offsetY = pos.y - g.pressY;
    }
    g.dragX = offsetX;
    g.dragY = offsetY;
    assert(''+offsetX !== 'NaN');

    if (script.parent) {
      script.parent.remove(script);
    }

    g.dragScript = script;
    g.dragScript.moveTo(g.dragX + g.mouseX, g.dragY + g.mouseY);
    g.dragScript.parent = this;
    this.elContents.appendChild(g.dragScript.el);
    g.dragScript.layoutChildren();
    g.dragScript.drawChildren();
    // g.dragScript.addShadow(this.dragShadowX, this.dragShadowY, this.dragShadowBlur, this.dragShadowColor);
    // this.showFeedback(g);
  }

  drop(g) {
    if (!g) g = this.getGesture(this);
    if (!g.dragging) return;

    // TODO
    this.add(g.dragScript);

    g.dragging = false;
    g.dragPos = null;
    g.dragState = null;
    g.dragWorkspace = null;
    g.dragScript = null;
    g.dropWorkspace = null;
    g.feedbackInfo = null;
    g.commandScript = null;
  }

  tick() {
    this.camera.update();
    this.el.style.transform = `scale(${this.camera.zoom})
                               translate(${-this.camera.left}px, ${this.camera.top}px)`;

    if (this.inertia) {
      this.wheel({
        deltaX: -this.inertia.x,
        deltaY: -this.inertia.y,
        ctrlKey: false,
      });
      this.friction = 0.9; // TODO sync this to *time* not refresh rate :P
      this.inertia = new Vec(this.inertia.x * this.friction, this.inertia.y * this.friction);
    }

    requestAnimationFrame(this.tick.bind(this));
  }

  resize(e) {
    // TODO resizing is flickery
    this.camera.width = window.innerWidth;
    this.camera.height = window.innerHeight;
    this.camera.update();
  }

  wheel(e) {
    // TODO trackpad should scroll vertically; mouse scroll wheel should zoom!
    if (e.preventDefault) e.preventDefault();
    if (e.ctrlKey) {
      this.factor -= e.deltaY;
      this.factor = Math.min(139, this.factor); // zoom <= 4.0
      var oldCursor = this.camera.fromScreen(e.clientX, e.clientY);
      this.camera.zoom = Math.pow(1.01, this.factor);
      this.camera.update();
      var newCursor = this.camera.fromScreen(e.clientX, e.clientY);
      var delta = oldCursor.sub(newCursor);
      this.camera.pos = this.camera.pos.add(delta);
      this.camera.update();
    } else {
      this.camera.pos = this.camera.pos.add(e.deltaX / this.camera.zoom, -e.deltaY / this.camera.zoom);
      this.camera.update();
    }
  }

  objectFromPoint(x, y) {
    var scripts = this.scripts;
    for (var i=scripts.length; i--;) {
      var script = scripts[i];
      var o = script.objectFromPoint(x - script.x, y - script.y);
      if (o) return o;
    }
    return this;
  }

  touchDown(e) {
    e.preventDefault();
    lastTouch = new Vec(e.touches[0].pageX, e.touches[0].pageY);
  }
  touchMove(e) {
    e.preventDefault();
    var touch = new Vec(e.touches[0].pageX, e.touches[0].pageY);
    var delta = touch.sub(this.lastTouch);
    this.wheel({
      deltaX: -delta.x,
      deltaY: -delta.y,
      ctrlKey: false,
    });
    this.lastTouch = touch;
    this.lastDelta = delta;
  }
  touchUp(e) {
    e.preventDefault();
    // TODO send click events
    this.inertia = this.lastDelta;
    this.lastTouch = undefined;
    this.lastDelta = undefined;
  }

  makeEvent(e) {
    var pos = this.camera.fromScreen(e.clientX, e.clientY);
    return {clientX: pos.x | 0, clientY: -pos.y | 0, identifier: this};
  }

  mouseDown(e) {
    var p = this.makeEvent(e);
    if (!this.startFinger(p, e)) return;
    this.fingerDown(p, e);
  }
  mouseMove(e) {
    var p = this.makeEvent(e);
    // this.updateMouse(p, e);
    this.fingerMove(p, e);
  }
  mouseUp(e) {
    var p = this.makeEvent(e);
    // this.updateMouse(p, e);
    this.fingerUp(p, e);
  }

  startFinger(p, e) {
    /*
    this.updateMouse(p, e);
    this.menuMouseDown(e);

    var pressType = this.pressType(e);
    if (pressType !== 'workspace' && (pressType !== 'input' || e.button === 2)) return false;
    */
    if (this.dragging) {
      this.drop();
      return false;
    }
    return true;
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
      if (g.dragging) this.drop(g);

      g.pressed = false;
      g.pressObject = null;
      g.dragging = false;
      g.resizing = false;
      g.shouldDrag = false;
      g.shouldResize = false;
      g.dragScript = null;

      delete this.fingers[id];
    }
  }

  fingerDown(p, e) {
    var g = this.createFinger(p.identifier);
    g.pressX = g.mouseX = p.clientX;
    g.pressY = g.mouseY = p.clientY;
    g.pressObject = this.objectFromPoint(g.pressX, g.pressY);
    g.shouldDrag = false;
    // g.shouldResize = false;
    
    if (g.pressObject) {
      var leftClick = e.button === 0 || e.button === undefined;
      if (e.button === 2 || leftClick && e.ctrlKey) {
        // TODO menus
      } else if (leftClick) {
        // if (g.pressObject.isResizable) {
        //   var pos = g.pressObject.worldPosition;
        //   g.shouldResize = g.pressObject.resizableAt(g.pressX - pos.x, g.pressY - pos.y);
        // }
        g.shouldDrag = g.pressObject.isDraggable; //!g.shouldResize && g.pressObject.isDraggable && !((g.pressObject.isTextArg) && e.target === g.pressObject.field); // TODO

        // TODO click and drag background to scroll
      }
    }
    if (g.shouldDrag) {
      document.activeElement.blur();
      e.preventDefault();
    }

    g.pressed = true;
    g.dragging = false;
  }

  fingerMove(p, e) {
    var g = this.getFinger(p.identifier);
    g.mouseX = p.clientX;
    g.mouseY = p.clientY;
    if (g.dragging) {
      g.dragScript.moveTo(g.dragX + g.mouseX, g.dragY + g.mouseY);
      // this.showFeedback(g);
      e.preventDefault();

    } else if (g.pressed && g.shouldDrag) {
      var block = g.pressObject.dragObject;
      // g.dragWorkspace = block.workspace;
      // g.dragPos = block.workspacePosition;
      // g.dragState = block.state;
      var pos = block.worldPosition;
      this.grab(block.detach(), pos.x - g.pressX, pos.y - g.pressY, g);
      e.preventDefault();

    //} else if (g.resizing) {
    //  g.pressObject.resizeTo(Math.max(g.pressObject.minWidth, (g.dragWidth + g.mouseX) / this._blockScale | 0), Math.max(g.pressObject.minHeight, (g.dragHeight + g.mouseY) / this._blockScale | 0));

    //} else if (g.shouldResize) {
    //  g.resizing = true;
    //  g.dragWidth = g.pressObject.width * this._blockScale - g.pressX;
    //  g.dragHeight = g.pressObject.height * this._blockScale - g.pressY;
    }
  }

  fingerUp(p, e) {
    var g = this.getFinger(p.identifier);
    g.mouseX = p.clientX;
    g.mouseY = p.clientY;
    if (g.dragging) {
      this.drop(g);
    } else if (g.resizing) {
    } else if (g.shouldDrag || g.shouldResize) {
      g.pressObject.click(g.pressX, g.pressY);
    }
    this.destroyFinger(p.identifier);
  }

  showFeedback(g) {
    this.resetFeedback(g);
    this.updateReporterFeedback(g);
    if (g.feedbackInfo) {
      this.renderFeedback(g);
      g.feedback.canvas.style.display = 'block';
    } else {
      if (g.dropWorkspace && g.dropWorkspace.isTarget) {
        g.dropWorkspace.showFeedback(g.dragScript);
      }
      g.feedback.canvas.style.display = 'none';
    }
  }
  
  resetFeedback(g) {
    g.feedbackDistance = Infinity;
    g.feedbackInfo = null;
    if (g.dropWorkspace && g.dropWorkspace.isTarget) {
      g.dropWorkspace.hideFeedback();
    }
    g.dropWorkspace = null;
  }

  updateReporterFeedback(g) {
    this.updateFeedback(g, this.addScriptReporterFeedback);
  };

  updateFeedback(g, p) {
    var workspaces = this.workspaces;
    for (var i = workspaces.length; i--;) {
      var ws = workspaces[i];
      var pos = ws.worldPosition;
      if (ws.el !== document.body) {
        var x = pos.x + ws.scrollX;
        var y = pos.y + ws.scrollY;
        var w = ws.width;
        var h = ws.height;
      }
      if (ws.el === document.body || g.mouseX >= x && g.mouseX < x + w && g.mouseY >= y && g.mouseY < y + h) {
        if (ws.isTarget && !ws.acceptsDropOf(g.dragScript)) continue;
        g.dropWorkspace = ws;
        if (ws.isPalette || ws.isTarget) return;

        var scripts = ws.scripts;
        var l = scripts.length;
        for (var j = 0; j < l; j++) {
          p.call(this, g, pos.x, pos.y, scripts[j]);
        }
        return;
      }
    }
  };

  addScriptReporterFeedback(g, x, y, script) {
    if (!script.isScript) return;
    x += script.x * density;
    y += script.y * density;
    var blocks = script.blocks;
    var length = blocks.length;
    for (var i = 0; i < length; i++) {
      this.addBlockReporterFeedback(g, x, y, blocks[i]);
    }
  };

  addBlockReporterFeedback(g, x, y, block) {
    x += block.x * density;
    y += block.y * density;
    var args = block.args;
    var length = args.length;
    for (var i = 0; i < length; i++) {
      var a = args[i];
      var ax = x + a.x * this._blockScale;
      var ay = y + a.y * this._blockScale;
      if (a._type === 't') {
        this.addScriptReporterFeedback(g, ax, ay, a.script);
      } else {
        if (a.isBlock) {
          this.addBlockReporterFeedback(g, x, y, a);
        }
      }
      if (a.acceptsDropOf(g.dragScript.blocks[0])) {
        this.addFeedback(g, {
          x: ax,
          y: ay,
          rangeX: this.feedbackRange,
          rangeY: this.feedbackRange,
          type: 'replace',
          block: block,
          arg: a
        });
      }
    }
  };

  addFeedback(g, obj) {
    var dx = obj.x - g.dragScript.x * this._blockScale;
    var dy = obj.y - g.dragScript.y * this._blockScale;
    var d2 = dx * dx + dy * dy;
    if (Math.abs(dx) > obj.rangeX * this._blockScale || Math.abs(dy) > obj.rangeY * this._blockScale || d2 > g.feedbackDistance) return;
    g.feedbackDistance = d2;
    g.feedbackInfo = obj;
  };

  renderFeedback(g) {
    var info = g.feedbackInfo
    var context = g.feedback;
    var canvas = g.feedback.canvas;
    var b = g.dragScript.blocks[0];
    var s = this._blockScale;
    var l = this.feedbackLineWidth;
    var r = l/2;

    var pi = b.puzzleInset * s;
    var pw = b.puzzleWidth * s;
    var p = b.puzzle * s;

    var x, y;
    switch (info.type) {
      case 'replace':
        x = info.x - l;
        y = info.y - l;
        var w = info.arg.width * s;
        var h = info.arg.height * s;
        canvas.width = w + l * 2;
        canvas.height = h + l * 2;

        context.translate(l, l);
        context.scale(s, s);

        info.arg.pathShadowOn(context);

        context.lineWidth = l / this._blockScale;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = this.feedbackColor;
        context.stroke();

        context.globalCompositeOperation = 'destination-out';
        context.beginPath();
        info.arg.pathShadowOn(context);
        context.fill();
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = .6;
        context.fillStyle = this.feedbackColor;
        context.fill();
        break;
    }
    if (x != null) {
      setTransform(canvas, 'translate('+x+'px,'+y+'px)');
    }
  };



  

  // TODO Safari 9.1 has *actual* gesture events: gestureDown/Change/Up to zoom
}
World.prototype.isWorkspace = true;

document.body.appendChild(new World().el);

