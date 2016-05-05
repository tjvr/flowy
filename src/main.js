
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

function Vec(x, y) {
  if (x && x.x !== undefined) { y = x.y; x = x.x; }
  this.x = x || 0;
  this.y = y || 0;
}
Vec.prototype.add = function(dx, dy) {
  var delta = new Vec(dx, dy);
  return new Vec(this.x + delta.x, this.y + delta.y);
};
Vec.prototype.sub = function(dx, dy) {
  var delta = new Vec(dx, dy);
  return new Vec(this.x - delta.x, this.y - delta.y);
};

/*****************************************************************************/

function elt(tag, attrs, ...args) {
  let result = document.createElement(tag)
  if (attrs) for (let name in attrs) {
    if (name == "style")
      result.style.cssText = attrs[name]
    else if (attrs[name] != null)
      result.setAttribute(name, attrs[name])
  }
  for (let i = 0; i < args.length; i++) add(args[i], result)
  return result
}

function add(value, target) {
  if (typeof value == "string")
    value = document.createTextNode(value)

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) add(value[i], target)
  } else {
    target.appendChild(value)
  }
}


var container = elt('div', {}, [ elt('h1', {}, "Hi!") ]);
container.style.border = '1px solid red';
container.style.position = 'absolute';
container.style.transformOrigin = 'top left';
document.body.appendChild(container)

var factor = 1;

function Camera(width, height) {
  this.pos = new Vec();
  this.width;
  this.height;
  this.zoom = 1;

  this.update();
}
Camera.prototype.update = function() {
  this.left = this.pos.x - (this.width / 2) / this.zoom;
  this.right = this.pos.x + (this.width / 2) / this.zoom;
  this.bottom = this.pos.y - (this.height / 2) / this.zoom;
  this.top = this.pos.y + (this.height / 2) / this.zoom;
};
Camera.prototype.toScreen = function(x, y) {
  var point = new Vec(x, y);
  return new Vec(
    (point.x - this.left) * this.zoom,
    (this.top - point.y) * this.zoom
  );
}
Camera.prototype.fromScreen = function(x, y) {
  var screen = new Vec(x, y);
  return new Vec(
    (screen.x / this.zoom) + this.left,
    -((screen.y / this.zoom) - this.top)
  );
};
var camera = new Camera();

function resize(e) {
  camera.width = window.innerWidth;
  camera.height = window.innerHeight;
  camera.update();
}
window.addEventListener('resize', resize);
resize();
// TODO resizing is flickery

function wheel(e) {
  if (e.preventDefault) e.preventDefault();
  if (e.ctrlKey) {
    factor -= e.deltaY;
    var oldCursor = camera.fromScreen(e.clientX, e.clientY);
    camera.zoom = Math.pow(1.01, factor);
    camera.update();
    var newCursor = camera.fromScreen(e.clientX, e.clientY); 
    var delta = oldCursor.sub(newCursor);
    camera.pos = camera.pos.add(delta);
    camera.update();
  } else {
    camera.pos = camera.pos.add(e.deltaX / camera.zoom, -e.deltaY / camera.zoom);
    camera.update();
  }
}
window.addEventListener('wheel', wheel);
window.addEventListener('mousewheel', wheel);
// TODO trackpad should scroll vertically; mouse scroll wheel should zoom!

var lastTouch;
var lastDelta;
var inertia = Vec(0, 0);
function touchDown(e) {
  e.preventDefault();
  lastTouch = new Vec(e.touches[0].pageX, e.touches[0].pageY);
}
function touchMove(e) {
  e.preventDefault();
  var touch = new Vec(e.touches[0].pageX, e.touches[0].pageY);
  var delta = touch.sub(lastTouch);
  wheel({
    deltaX: -delta.x,
    deltaY: -delta.y,
    ctrlKey: false,
  });
  lastTouch = touch;
  lastDelta = delta;
}
function touchUp(e) {
  e.preventDefault();
  // TODO send click events
  inertia = lastDelta;
  lastTouch = undefined;
  lastDelta = undefined;
}
window.addEventListener('touchstart', touchDown);
window.addEventListener('touchmove', touchMove);
window.addEventListener('touchend', touchUp);
window.addEventListener('touchcancel', touchUp);

// TODO Safari 9.1 gestureDown/Change/Up to zoom
// TODO click and drag background to party

var ground = new Vec(0, -100);
var foo = new Vec(0, -75);

var pic = renderChar("💩");

function paint() {
  // var width = camera.width = ctx.canvas.width;
  // var height = camera.height = ctx.canvas.height;
  camera.update();
  container.style.left = -camera.left * camera.zoom + 'px';
  container.style.top = camera.top * camera.zoom + 'px';
  container.style.transform = 'scale(' + camera.zoom + ')';

  if (inertia) {
    wheel({
      deltaX: -inertia.x,
      deltaY: -inertia.y,
      ctrlKey: false,
    });
    friction = 0.9; // TODO sync this to *time* not refresh rate :P
    inertia = new Vec(inertia.x * friction, inertia.y * friction);
  }

  requestAnimationFrame(paint);
}
paint();

function renderChar(text) {
  var canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 200;
  var ctx = canvas.getContext("2d");

  ctx.font = "200px monospace";
  ctx.fillText(text, 0, 200 - 10);
  return canvas; //ctx.getImageData(0, 0, 200, 200);
}


