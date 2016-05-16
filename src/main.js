
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
    this.el.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this._zoom})`;
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
    this.el.style.width = this.width;
    this.el.style.height = this.height;
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

  get isInput() { return true; }

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

  pathShadowOn(context) {
    this.pathFn(context);
    context.closePath();
  }

}
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

    this.outputs = [];
    this.curves = [];
    this.addOutput(new Result(this));
    this.outputs[0].curve = null;
    this.outputs[0].parent = this;
  }

  get isOperator() { return true; }
  get isDraggable() { return true; }

  get color() { return this._color }
  set color(value) {
    this._color = value;
    this.redraw();
  }

  add(part) {
    if (part.parent) part.parent.remove(part);
    part.parent = this;
    part.zoom = 1;
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
    newPart.zoom = 1;

    var index = this.parts.indexOf(oldPart);
    this.parts.splice(index, 1, newPart);

    var array = oldPart.isOperator || oldPart.isInput ? this.args : this.labels;
    var index = array.indexOf(oldPart);
    array.splice(index, 1, newPart);

    newPart.layoutChildren();
    this.layout();
    if (this.workspace) newPart.drawChildren();

    this.el.replaceChild(newPart.el, oldPart.el);
  };

  remove(part) {
    if (part.parent !== this) return;
    if (part.isResult) return this.removeOutput(part);
    part.parent = null;
    var index = this.parts.indexOf(part);
    this.parts.splice(index, 1);
    this.el.removeChild(part.el);

    var array = part.isOperator ? this.args : this.labels;
    var index = array.indexOf(part);
    array.splice(index, 1);
  }

  addOutput(output) {
    this.outputs.push(output);
    output.target = this;

    var curve = new Curve(this, output);
    output.curve = this.curves.length >= 1 ? curve : null;
    this.curves.push(curve);

    this.el.appendChild(this.outputs[0].el);
  }

  removeOutput(output) {
    var index = this.outputs.indexOf(output);
    this.outputs.splice(index, 1);
    output.parent = null;
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
    return this;
    // if (this.parent.isScript) {
    //   return this.parent.splitAt(this);
    // }
  }

  moveTo(x, y) {
    super.moveTo(x, y);
    this.moved();
  }

  moved() {
    this.parts.forEach(p => p.moved());
    this.curves.forEach(c => c.layoutSelf());
  }

  objectFromPoint(x, y) {
    var output = this.outputs[0];
    assert(output.parent === this);
    // TODO don't grab invisible bubbles
    var o = output.objectFromPoint(x - output.x, y - output.y)
    if (o) return o;
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
    this.outputs.forEach(o => o.layoutChildren()); // TODO ew
    if (this.dirty) {
      this.dirty = false;
    }
      this.layoutSelf(); // TODO mark dirty when hiding/showing result bubble
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

    var output = this.outputs[0];
    assert(output.parent === this);
    var x = (width - output.width) / 2;
    output.moveTo(x, height - 1 + Result.tipSize);
    this.width = width;
    this.height = height;

    this.curves.forEach(c => c.layoutSelf());
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
    var hideOutput = (this.parent && this.parent.isOperator) || !this.workspace || this.workspace.isPalette || this.parent.isApp;
    //console.log(this.parts[0].text, hideOutput, this.parent);
    this.outputs[0].el.style.visibility = hideOutput ? 'hidden' : 'visible';
    this.curves[0].el.style.visibility = 'hidden';
  }

  drawOn(context) {
    context.fillStyle = this._color;
    bezel(context, this.pathBlock, this, false, density);
  }
}



class Result extends Drawable {
  constructor(target) {
    super();

    this.el = el('absolute');
    this.el.appendChild(this.canvas = el('canvas', 'absolute'));
    this.context = this.canvas.getContext('2d');

    this.target = target;
    this.curve = null;
    this.value = "3.14";
    this.label = new Label(this.value, 'result-label');
    this.el.appendChild(this.label.el);

    if (target.workspace) target.workspace.add(this);
  }

  get isResult() { return true; }
  get isDraggable() { return true; }

  objectFromPoint(x, y) {
    return opaqueAt(this.context, x * density, y * density) ? this : null;
  }

  get dragObject() {
    return this;
  }

  detach() {
    if (!this.curve) {
      return this.copy();
    }
    if (this.parent.isOperator) {
      this.parent.replace(this, new Input(""));
      return this;
    }
    return this;
  }

  copy() {
    var r = new Result(this.target);
    this.target.addOutput(r);
    return r;
  }

  click() {
    console.log('click result');
  }

  moveTo(x, y) {
    super.moveTo(x, y - Result.tipSize);
    this.moved();
  }

  moved() {
    if (this.curve) this.curve.layoutSelf();
  }

  layoutSelf() {
    var t = Result.tipSize;
    var px = Result.paddingX
    var py = Result.paddingY;
    this.width = Math.max(Result.minWidth, this.label.width + 2 * px);
    this.height = this.label.height + 2 * py;
    this.canvasWidth = this.width;
    this.canvasHeight = this.height + t;
    var x = (this.width - this.label.width) / 2;
    var y = t + py;
    this.label.moveTo(x, y);
    this.redraw();
  }

  pathBubble(context) {
    var t = Result.tipSize;
    var w = this.width;
    var h = this.height + t;
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
    this.canvas.width = this.canvasWidth * density;
    this.canvas.height = this.canvasHeight * density;
    this.canvas.style.width = this.canvasWidth + 'px';
    this.canvas.style.height = this.canvasHeight + 'px';
    this.context.scale(density, density);
    this.drawOn(this.context);
  }

  drawOn(context) {
    this.pathBubble(context);
    context.closePath();
    context.fillStyle = '#fff';
    context.fill();
    context.strokeStyle = '#555';
    context.lineWidth = density;
    context.stroke();
  }

}

Result.tipSize = 6;
Result.paddingX = 6;
Result.paddingY = 2;
Result.minWidth = 32;



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
    if (!this.result.curve) return;
    assert(this.workspace);

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
  }

  remove() {}
}

/*****************************************************************************/

//import {primitives} from "./runtime";
var primitives = [];

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
  return new Operator({}, parts);
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
    return super.objectFromPoint(pos.x | 0, pos.y | 0);
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
      left: this.scrollX - (this.width / 2) / this.zoom | 0,
      right: this.scrollX + (this.width / 2) / this.zoom | 0,
      bottom: this.scrollY - (this.height / 2) / this.zoom | 0,
      top: this.scrollY + (this.height / 2) / this.zoom | 0,
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
    this.workspaces = [this.world]; //, this.palette];
    this.el.appendChild(this.world.el);
    this.el.appendChild(this.palette.el);

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

    if (g.scrolling) {
      g.pressObject.fingerScroll(g.mouseX - g.scrollX, g.mouseY - g.scrollY)
      g.scrollX = g.mouseX;
      g.scrollY = g.mouseY;
      e.preventDefault();
    } else if (g.dragging) {
      g.dragScript.moveTo((g.dragX + g.mouseX), (g.dragY + g.mouseY));
      this.showFeedback(g);
      e.preventDefault();
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
      info.node.parent.replace(info.node, g.dragScript);
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
      w.scripts.forEach(script => this.addNodeFeedback(g, pos.x, pos.y, script));
    }

    if (g.feedbackInfo) {
      this.renderFeedback(g);
      g.feedback.canvas.style.display = 'block';
    } else {
      g.feedback.canvas.style.display = 'none';
    }
  }

  addNodeFeedback(g, x, y, node) {
    x += node.x * this.world.zoom;
    y += node.y * this.world.zoom;
    if (node.isOperator) {
      node.parts.forEach(child => this.addNodeFeedback(g, x, y, child));
    }

    if (node.isInput) {
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

var app = new App();

