
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
  context.shadowColor = 'rgba(0, 0, 0, .4)';
  context.fill();

  context.shadowOffsetX = (10000 + s * 1) * scale;
  context.shadowOffsetY = (10000 + s * 1) * scale;
  context.shadowBlur = 1.5 * scale;
  context.shadowColor = 'rgba(255, 255, 255, .3)';
  context.fill();

  context.restore();
}

/*****************************************************************************/

var scale = 1;

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
    this.x = x;
    this.y = y;
    this.el.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
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
    } else {
      this.graphicsDirty = true;
    }
  }

  // layoutSelf() {}
  // draw() {}
}


class Label extends Drawable {
  constructor(text) {
    assert(typeof text === 'string');
    super();
    this.el = el('absolute label');
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
}
Label.measure = createMetrics('label');


class Operator extends Drawable {
  constructor(info, parts) {
    super();

    this.el = el('absolute');
    this.canvas = el('canvas', 'absolute');
    this.el.appendChild(this.canvas);
    this.context = this.canvas.getContext('2d');

    this.info = info;
    this.parts = parts;
    parts.forEach(w => this.el.appendChild(w.el));

    this.color = '#00f';
  }

  get color() { return this._color }
  set color(value) {
    this._color = value;
    this.redraw();
  }

  layoutChildren() {
    this.parts.forEach(c => c.layoutChildren());
    if (this.dirty) {
      this.dirty = false;
      this.layoutSelf();
    }
  }

  drawChildren() {
    this.parts.forEach(c => c.drawChildren());
    if (this.graphicsDirty) {
      this.graphicsDirty = false;
      this.draw();
    }
  }

  layoutSelf() {
    // TODO

    var width = 0;
    var height = 12;
    var xs = [];

    var parts = this.parts;
    var length = parts.length;
    for (var i=0; i<length; i++) {
      var part = parts[i];

      height = Math.max(height, part.height);
      xs.push(width);
      width += part.width;
    }
    width = Math.max(40, width);

    for (var i=0; i<length; i++) {
      var part = parts[i];
      var x = xs[i];
      var y = (height - part.height) / 2;
      part.moveTo(x, y);
    }

    this.ownWidth = width;
    this.ownHeight = height;
    this.width = width;
    this.height = height;

    this.redraw();
  }

  pathFn(context) {
    var w = this.ownWidth;
    var h = this.ownHeight;
    var r = Math.min(w, (this.hasScript ? 15 : h)) / 2;

    context.moveTo(0, r);
    context.arc(r, r, r, PI, PI32, false);
    context.arc(w - r, r, r, PI32, 0, false);
    context.arc(w - r, h - r, r, 0, PI12, false);
    context.arc(r, h - r, r, PI12, PI, false);
  }

  pathBlock(context) {
    context.closePath();
    var w = this.ownWidth;
    var r = this.radius;
    var ri = r - 1;
    var p = this.puzzle;
    var pi = this.puzzleInset;
    var pw = this.puzzleWidth;
  }

  draw() {
    this.canvas.width = this.ownWidth * scale;
    this.canvas.height = this.ownHeight * scale;
    this.context.scale(scale, scale);
    this.drawOn(this.context);
  }
  
  drawOn(context) {
    context.fillStyle = this._color;
    bezel(context, this.pathBlock, this, false, this._scale);
  }
}


































































































/*****************************************************************************/

var factor = 1;

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
    this.el = el('world');

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

    window.x = new Operator({}, [
      new Label("bob"),
      new Label("fred"),
    ]);
    setTimeout(() => {
      x.layoutChildren();
      //l.layoutChildren();
      //l.drawChildren();
      this.el.appendChild(x.el);
    });
  }

  tick() {
    this.camera.update();
    var transform = 'scale(' + this.camera.zoom + ') ';
    transform += 'translate(' + -this.camera.left + 'px, ' + this.camera.top + 'px) ';
    this.el.style.transform = transform;

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
      factor -= e.deltaY;
      var oldCursor = this.camera.fromScreen(e.clientX, e.clientY);
      this.camera.zoom = Math.pow(1.01, factor);
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

  // TODO Safari 9.1 gestureDown/Change/Up to zoom
  // TODO click and drag background to party
}

document.body.appendChild(new World().el);

