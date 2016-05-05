
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

var canvas = document.createElement('canvas');
document.body.appendChild(canvas)
var ctx = canvas.getContext("2d");

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
  ctx.canvas.width = window.innerWidth;
  ctx.canvas.height = window.innerHeight;
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
    console.log(e);
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
  var width = camera.width = ctx.canvas.width;
  var height = camera.height = ctx.canvas.height;
  camera.update();

  // bg sky
  ctx.fillStyle = "#eee";
  ctx.fillRect(0, 0, width, height);

  // ground
  ctx.fillStyle = "#ddd";
  ctx.fillRect(0, camera.toScreen(ground).y, width, height - camera.toScreen(ground).y);

  // box
  ctx.fillStyle = "#404040";
  var screenFoo = camera.toScreen(foo);
  ctx.fillRect(screenFoo.x, screenFoo.y, 50 * camera.zoom, 50 * camera.zoom);

  // text
  var scale = 0.25;
  ctx.save();
  ctx.translate(screenFoo.x, screenFoo.y - 200 * scale * camera.zoom);
  ctx.scale(scale * camera.zoom, scale * camera.zoom);
  //ctx.putImageData(pic, screenFoo.x, screenFoo.y - 200);
  ctx.drawImage(pic, 0, 0);
  ctx.restore();

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


