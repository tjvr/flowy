
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

var metricsContainer = el('metrics-container');
document.body.appendChild(metricsContainer);

function createMetrics(className) {
  var field = el('Visual-metrics ' + className);
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

  get text() {
    return this._text;
  }

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

    window.l = new Label("bob");
    setTimeout(() => {
      l.layoutChildren();
      l.drawChildren();
      this.el.appendChild(l.el);
    });
  }

  tick() {
    this.camera.update();
    this.el.style.left = -this.camera.left * this.camera.zoom + 'px';
    this.el.style.top = this.camera.top * this.camera.zoom + 'px';
    this.el.style.transform = 'scale(' + this.camera.zoom + ')';

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

