
/* utils */

function assert(bool, message) {
  if (!bool) throw "Assertion failed! " + (message || "");
}

function isArray(o) {
  return o && o.constructor === Array;
}

function bool(x) { return !!x; }

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

// deep clone dictionaries/lists.
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

function indent(text) {
  return text.split("\n").map(function(line) {
    return "  " + line;
  }).join("\n");
}

/*****************************************************************************/

/* for constucting SVGs */

var xml = new DOMParser().parseFromString('<xml></xml>',  "application/xml")
function cdata(content) {
  return xml.createCDATASection(content);
}

function el(name, props) {
  var el = document.createElementNS("http://www.w3.org/2000/svg", name);
  return setProps(el, props);
}

var directProps = {
  textContent: true,
};
function setProps(el, props) {
  for (var key in props) {
    var value = '' + props[key];
    if (directProps[key]) {
      el[key] = value;
    } else if (/^xlink:/.test(key)) {
      el.setAttributeNS("http://www.w3.org/1999/xlink", key.slice(6), value);
    } else if (props[key] !== null && props.hasOwnProperty(key)) {
      el.setAttributeNS(null, key, value);
    }
  }
  return el;
}

function withChildren(el, children) {
  for (var i=0; i<children.length; i++) {
    el.appendChild(children[i]);
  }
  return el;
}

function group(children) {
  return withChildren(el('g'), children);
}

function newSVG(width, height) {
  return el('svg', {
    version: "1.1",
    width: width,
    height: height,
  });
}

function embedHTML(x, y, dom) {
  var body = document.createElementNS("http://www.w3.org/1999/xhtml", 'body');
  if (!isArray(dom)) dom = [dom];
  dom.forEach(el => {
    body.appendChild(el);
  });
  body.style.position = 'absolute';
  body.style.left = `${x}px`;
  body.style.top = `${y}px`;
  var foreign = el('foreignObject', {
    x: 0,
    y: 0,
    width: '100px',
    height: '16px',
  });
  foreign.appendChild(body);
  return foreign; //move(x, y, foreign);
}

function polygon(props) {
  return el('polygon', extend(props, {
    points: props.points.join(" "),
  }));
}

function path(props) {
  return el('path', extend(props, {
    path: null,
    d: props.path.join(" "),
  }));
}

function text(x, y, content, props) {
  return el('text', extend(props, {
    x: x,
    y: y,
    textContent: content,
  }));
}

function symbol(href) {
  return el('use', {
    'xlink:href': href,
  });
}

function move(dx, dy, el) {
  return setProps(el, {
    transform: ['translate(', dx, ' ', dy, ')'].join(''),
  });
}

function translatePath(dx, dy, path) {
  var isX = true;
  var parts = path.split(" ");
  var out = [];
  for (var i=0; i<parts.length; i++) {
    var part = parts[i];
    if (part === 'A') {
      var j = i + 5;
      out.push('A');
      while (i < j) {
        out.push(parts[++i]);
      }
      continue;
    } else if (/[A-Za-z]/.test(part)) {
      assert(isX);
    } else {
      part = +part;
      part += isX ? dx : dy;
      isX = !isX;
    }
    out.push(part);
  }
  return out.join(" ");
}


/* shapes */

function rect(w, h, props) {
  return el('rect', extend(props, {
    x: 0,
    y: 0,
    width: w,
    height: h,
  }));
}

function arc(p1x, p1y, p2x, p2y, rx, ry) {
  var r = p2y - p1y;
  return ["L", p1x, p1y, "A", rx, ry, 0, 0, 1, p2x, p2y].join(" ");
}

function arcw(p1x, p1y, p2x, p2y, rx, ry) {
  var r = p2y - p1y;
  return ["L", p1x, p1y, "A", rx, ry, 0, 0, 0, p2x, p2y].join(" ");
}

function roundedPath(w, h) {
  var r = h / 2;
  return [
    "M", r, 0,
    arc(w - r, 0, w - r, h, r, r),
    arc(r, h, r, 0, r, r),
    "Z"
  ];
}

function roundedRect(w, h, props) {
  return path(extend(props, {
    path: roundedPath(w, h),
  }));
}

function pointedPath(w, h) {
  var r = h / 2;
  return [
    "M", r, 0,
    "L", w - r, 0, w, r,
    "L", w, r, w - r, h,
    "L", r, h, 0, r,
    "L", 0, r, r, 0,
    "Z",
  ];
}

function pointedRect(w, h, props) {
  return path(extend(props, {
    path: pointedPath(w, h),
  }));
}

function getTop(w) {
  return ["M", 0, 3,
    "L", 3, 0,
    "L", 13, 0,
    "L", 16, 3,
    "L", 24, 3,
    "L", 27, 0,
    "L", w - 3, 0,
    "L", w, 3
  ].join(" ");
}

function getRingTop(w) {
  return ["M", 0, 3,
    "L", 3, 0,
    "L", 7, 0,
    "L", 10, 3,
    "L", 16, 3,
    "L", 19, 0,
    "L", w - 3, 0,
    "L", w, 3
  ].join(" ");
}

function getRightAndBottom(w, y, hasNotch, inset) {
  if (typeof inset === "undefined") {
    inset = 0;
  }
  var arr = ["L", w, y - 3,
    "L", w - 3, y
  ];
  if (hasNotch) {
    arr = arr.concat([
      "L", inset + 27, y,
      "L", inset + 24, y + 3,
      "L", inset + 16, y + 3,
      "L", inset + 13, y
    ]);
  }
  if (inset > 0) {
    arr = arr.concat([
      "L", inset + 2, y,
      "L", inset, y + 2
    ])
  } else {
    arr = arr.concat([
      "L", inset + 3, y,
      "L", 0, y - 3
    ]);
  }
  return arr.join(" ");
}

function getArm(w, armTop) {
  return [
    "L", 15, armTop - 2,
    "L", 15 + 2, armTop,
    "L", w - 3, armTop,
    "L", w, armTop + 3
  ].join(" ");
}


function stackRect(w, h, props) {
  return path(extend(props, {
    path: [
      getTop(w),
      getRightAndBottom(w, h, true, 0),
      "Z",
    ],
  }));
}

function capPath(w, h) {
  return [
    getTop(w),
    getRightAndBottom(w, h, false, 0),
    "Z",
  ];
}

function ringCapPath(w, h) {
  return [
    getRingTop(w),
    getRightAndBottom(w, h, false, 0),
    "Z",
  ];
}

function capRect(w, h, props) {
  return path(extend(props, {
    path: capPath(w, h),
  }));
}

function hatRect(w, h, props) {
  return path(extend(props, {
    path: [
      "M", 0, 12,
      arc(0, 12, 80, 10, 80, 80),
      "L", w - 3, 10, "L", w, 10 + 3,
      getRightAndBottom(w, h, true),
      "Z",
    ],
  }));
}

function curve(p1x, p1y, p2x, p2y, roundness) {
  var roundness = roundness || 0.42;
  var midX = (p1x + p2x) / 2.0;
  var midY = (p1y + p2y) / 2.0;
  var cx = Math.round(midX + (roundness * (p2y - p1y)));
  var cy = Math.round(midY - (roundness * (p2x - p1x)));
  return [cx, cy, p2x, p2y].join(" ");
}

function procHatBase(w, h, archRoundness, props) {
  // TODO use arc()
  var archRoundness = Math.min(0.2, 35 / w);
  return path(extend(props, {
    path: [
      "M", 0, 15,
      "Q", curve(0, 15, w, 15, archRoundness),
      getRightAndBottom(w, h, true),
      "M", -1, 13,
      "Q", curve(-1, 13, w + 1, 13, archRoundness),
      "Q", curve(w + 1, 13, w, 16, 0.6),
      "Q", curve(w, 16, 0, 16, -archRoundness),
      "Q", curve(0, 16, -1, 13, 0.6),
      "Z",
    ],
  }));
}

function procHatCap(w, h, archRoundness) {
  // TODO use arc()
  // TODO this doesn't look quite right
  return path({
    path: [
      "M", -1, 13,
      "Q", curve(-1, 13, w + 1, 13, archRoundness),
      "Q", curve(w + 1, 13, w, 16, 0.6),
      "Q", curve(w, 16, 0, 16, -archRoundness),
      "Q", curve(0, 16, -1, 13, 0.6),
      "Z",
    ],
    class: 'sb-define-hat-cap',
  });
}

function procHatRect(w, h, props) {
  var q = 52;
  var y = h - q;

  var archRoundness = Math.min(0.2, 35 / w);

  return move(0, y, group([
      procHatBase(w, q, archRoundness, props),
      procHatCap(w, q, archRoundness),
  ]));
}

function mouthRect(w, h, isFinal, lines, props) {
  var y = lines[0].height;
  var p = [
    getTop(w),
    getRightAndBottom(w, y, true, 15),
  ];
  for (var i=1; i<lines.length; i += 2) {
    var isLast = (i + 2 === lines.length);

    y += lines[i].height - 3;
    p.push(getArm(w, y));

    var hasNotch = !(isLast && isFinal);
    var inset = isLast ? 0 : 15;
    y += lines[i + 1].height + 3;
    p.push(getRightAndBottom(w, y, hasNotch, inset));
  }
  return path(extend(props, {
    path: p,
  }));
}

function ringRect(w, h, cy, cw, ch, shape, props) {
  var r = 8;
  var func = shape === 'reporter' ? roundedPath
           : shape === 'boolean' ? pointedPath
           : cw < 40 ? ringCapPath : capPath;
  return path(extend(props, {
    path: [
      "M", r, 0,
      arcw(r, 0, 0, r, r, r),
      arcw(0, h - r, r, h, r, r),
      arcw(w - r, h, w, h - r, r, r),
      arcw(w, r, w - r, 0, r, r),
      "Z",
      translatePath(4, cy || 4, func(cw, ch).join(" ")),
    ],
    'fill-rule': 'even-odd',
  }));
}

function commentRect(w, h, props) {
  var r = 6;
  return path(extend(props, {
    class: 'sb-comment',
    path: [
      "M", r, 0,
      arc(w - r, 0, w, r, r, r),
      arc(w, h - r, w - r, h, r, r),
      arc(r, h, 0, h - r, r, r),
      arc(0, r, r, 0, r, r),
      "Z"
    ],
  }));
}

function commentLine(width, props) {
  return move(-width, 9, rect(width, 2, extend(props, {
    class: 'sb-comment-line',
  })));
}

/* definitions */

var cssContent = `

.sb-label {
  font-family: Lucida Grande, Verdana, Arial, DejaVu Sans, sans-serif;
  font-weight: bold;
  fill: #fff;
  font-size: 10px;
  word-spacing: +1px;
}

.sb-obsolete { fill: #d42828; }
.sb-motion { fill: #4a6cd4; }
.sb-looks { fill: #8a55d7; }
.sb-sound { fill: #bb42c3; }
.sb-pen { fill: #0e9a6c;  }
.sb-events { fill: #c88330; }
.sb-control { fill: #e1a91a; }
.sb-sensing { fill: #2ca5e2; }
.sb-operators { fill: #5cb712; }
.sb-variables { fill: #ee7d16; }
.sb-list { fill: #cc5b22 }
.sb-custom { fill: #632d99; }
.sb-custom-arg { fill: #5947b1; }
.sb-extension { fill: #4b4a60; }
.sb-grey { fill: #969696; }

.sb-bevel {
  filter: url(#bevelFilter);
}

.sb-input {
  filter: url(#inputBevelFilter);
}
.sb-input-number,
.sb-input-string,
.sb-input-number-dropdown {
  fill: #fff;
}
.sb-literal-number,
.sb-literal-string,
.sb-literal-number-dropdown,
.sb-literal-dropdown {
  font-weight: normal;
  font-size: 9px;
  word-spacing: 0;
}
.sb-literal-number,
.sb-literal-string,
.sb-literal-number-dropdown {
  fill: #000;
}

.sb-darker {
  filter: url(#inputDarkFilter);
}

.sb-outline {
  stroke: #fff;
  stroke-opacity: 0.2;
  stroke-width: 2;
  fill: none;
}

.sb-define-hat-cap {
  stroke: #632d99;
  stroke-width: 1;
  fill: #8e2ec2;
}

.sb-comment {
  fill: #ffffa5;
  stroke: #d0d1d2;
  stroke-width: 1;
}
.sb-comment-line {
  fill: #ffff80;
}
.sb-comment-label {
  font-family: Helevetica, Arial, DejaVu Sans, sans-serif;
  font-weight: bold;
  fill: #5c5d5f;
  word-spacing: 0;
  font-size: 12px;
}

`

function makeStyle() {
  var style = el('style');
  style.appendChild(cdata(cssContent));
  return style;

}

/*****************************************************************************/

var Filter = function(id, props) {
  this.el = el('filter', extend(props, {
    id: id,
    x0: '-50%',
    y0: '-50%',
    width: '200%',
    height: '200%',
  }));
  this.highestId = 0;
};
Filter.prototype.fe = function(name, props, children) {
  var shortName = name.toLowerCase().replace(/gaussian|osite/, '');
  var id = [shortName, '-', ++this.highestId].join('');
  this.el.appendChild(withChildren(el("fe" + name, extend(props, {
    result: id,
  })), children || []));
  return id;
}
Filter.prototype.comp = function(op, in1, in2, props) {
  return this.fe('Composite', extend(props, {
    operator: op,
    in: in1,
    in2: in2,
  }));
}
Filter.prototype.subtract = function(in1, in2) {
  return this.comp('arithmetic', in1, in2, { k2: +1, k3: -1 });
}
Filter.prototype.offset = function(dx, dy, in1) {
  return this.fe('Offset', {
    in: in1,
    dx: dx,
    dy: dy,
  });
}
Filter.prototype.flood = function(color, opacity, in1) {
  return this.fe('Flood', {
    in: in1,
    'flood-color': color,
    'flood-opacity': opacity,
  });
}
Filter.prototype.blur = function(dev, in1) {
  return this.fe('GaussianBlur', {
    'in': 'SourceAlpha',
    stdDeviation: [dev, dev].join(' '),
  });
}
Filter.prototype.merge = function(children) {
  this.fe('Merge', {}, children.map(function(name) {
    return el('feMergeNode', {
      in: name,
    });
  }));
}

function bevelFilter(id, inset) {
  var f = new Filter(id);

  var alpha = 'SourceAlpha';
  var s = inset ? -1 : 1;
  var blur = f.blur(1, alpha);

  f.merge([
    'SourceGraphic',
    f.comp('in',
         f.flood('#fff', 0.15),
         f.subtract(alpha, f.offset(+s, +s, blur))
    ),
    f.comp('in',
         f.flood('#000', 0.7),
         f.subtract(alpha, f.offset(-s, -s, blur))
    ),
  ]);

  return f.el;
}

function darkFilter(id) {
  var f = new Filter(id);

  f.merge([
    'SourceGraphic',
    f.comp('in',
      f.flood('#000', 0.2),
      'SourceAlpha'),
  ]);

  return f.el;
}

function darkRect(w, h, category, el) {
  return setProps(group([
    setProps(el, {
      class: ['sb-'+category, 'sb-darker'].join(' '),
    })
  ]), { width: w, height: h });
}


/* layout */

function draw(o) {
  o.draw();
}

var Metrics = function(width) {
  this.width = width;
};

/* Label */

var Label = function(value, cls) {
  this.value = value;
  this.cls = cls || '';
  this.el = null;
  this.height = 12;
  this.metrics = null;
  this.x = 0;
};
Label.prototype.isLabel = true;

Label.prototype.stringify = function() {
  if (this.value === "<" || this.value === ">") return this.value;
  return (this.value
    .replace(/([<>[\](){}])/g, "\\$1")
  );
};

Label.prototype.draw = function() {
  return this.el;
};

Object.defineProperty(Label.prototype, 'width', {
  get: function() {
    return this.metrics.width;
  },
});

Label.measuring = (function() {
  var svg = setProps(newSVG(1, 1), {
    class: 'sb-measure',
  });
  svg.style.visibility = 'hidden';
  svg.style.position = 'absolute';
  svg.style.top = '-1px';
  svg.style.left = '-1px';
  svg.style.width = '1px';
  svg.style.height = '1px';
  svg.style.visibility = 'hidden';
  svg.style.overflow = 'hidden';
  svg.style.pointerEvents = 'none';
  document.body.appendChild(svg);
  return svg;
}());

Label.metricsCache = {};
Label.toMeasure = [];

Label.prototype.measure = function() {
  var value = this.value;
  var cls = this.cls;
  this.el = text(0, 10, value, {
    class: 'sb-label ' + cls,
  });

  var cache = Label.metricsCache[cls];
  if (!cache) {
    cache = Label.metricsCache[cls] = Object.create(null);
  }
  if (Object.hasOwnProperty.call(cache, value)) {
    this.metrics = cache[value];
  } else {
    this.metrics = cache[value] = Label.measure(this);
  }
};

Label.measure = function(label) {
  Label.measuring.appendChild(label.el);
  Label.toMeasure.push(label);
  return new Metrics();
};
Label.endMeasuring = function(cb) {
  var toMeasure = Label.toMeasure;
  Label.toMeasure = [];

  setTimeout(Label.measureAll.bind(null, toMeasure, cb), 0);
};
Label.measureAll = function(toMeasure, cb) {
  for (var i=0; i<toMeasure.length; i++) {
    var label = toMeasure[i];
    var metrics = label.metrics;
    var bbox = label.el.getBBox();
    metrics.width = (bbox.width + 0.5) | 0;

    var trailingSpaces = / *$/.exec(label.value)[0].length || 0;
    for (var j=0; j<trailingSpaces; j++) {
      metrics.width += 4.15625;
    }
  }
  cb();
};


/* Icon */

var Icon = function(name) {
  this.name = name;
  this.isArrow = name === 'loopArrow';

  var info = Icon.icons[name];
  assert(info, "no info for icon " + name);
  extend(info, this);
};
Icon.prototype.isIcon = true;

Icon.prototype.stringify = function() {
  return unicodeIcons["@" + this.name] || "";
};

Icon.icons = {
  greenFlag: { width: 20, height: 21, dy: -2 },
  turnLeft: { width: 15, height: 12, dy: +1 },
  turnRight: { width: 15, height: 12, dy: +1 },
  loopArrow: { width: 14, height: 11 },
  addInput: { width: 4, height: 8 },
  delInput: { width: 4, height: 8 },
};
Icon.prototype.draw = function() {
  return symbol('#' + this.name, {
    width: this.width,
    height: this.height,
  });
};


/* Input */

var Input = function(shape, value, menu) {
  this.shape = shape;
  this.value = value;
  this.menu = menu || null;

  this.isRound = shape === 'number' || shape === 'number-dropdown';
  this.isBoolean = shape === 'boolean';
  this.isStack = shape === 'stack';
  this.isInset = shape === 'boolean' || shape === 'stack' || shape === 'reporter';
  this.isColor = shape === 'color';
  this.hasArrow = shape === 'dropdown' || shape === 'number-dropdown';
  this.isDarker = shape === 'boolean' || shape === 'stack' || shape === 'dropdown';
  this.isSquare = shape === 'string' || shape === 'color' || shape === 'dropdown';

  this.hasLabel = !(this.isColor || this.isInset);
  this.label = this.hasLabel ? new Label(value, ['sb-literal-' + this.shape]) : null;
  this.x = 0;
};
Input.prototype.isInput = true;

Input.prototype.measure = function() {
  if (this.hasLabel) this.label.measure();
};

Input.shapes = {
  'string': rect,
  'number': roundedRect,
  'number-dropdown': roundedRect,
  'color': rect,
  'dropdown': rect,

  'boolean': pointedRect,
  'stack': stackRect,
  'reporter': roundedRect,
};

Input.prototype.draw = function(parent) {
  if (this.hasLabel) {
    var label = this.label.draw();
    var w = Math.max(14, this.label.width + (this.shape === 'string' || this.shape === 'number-dropdown' ? 6 : 9));
  } else {
    var w = this.isInset ? 30 : this.isColor ? 13 : null;
  }
  if (this.hasArrow) w += 10;
  this.width = w;

  var h = this.height = this.isRound || this.isColor ? 13 : 14;

  var el = Input.shapes[this.shape](w, h);
  if (this.isColor) {
    setProps(el, {
      fill: this.value,
    });
  } else if (this.isDarker) {
    el = darkRect(w, h, parent.info.category, el);
    if (parent.info.color) {
      setProps(el, {
        fill: parent.info.color,
      });
    }
  }

  var result = group([
    setProps(el, {
      class: ['sb-input', 'sb-input-'+this.shape].join(' '),
    }),
  ]);
  if (this.hasLabel) {
    var x = this.isRound ? 5 : 4;
    result.appendChild(move(x, 0, label));
  }
  if (this.hasArrow) {
    var y = this.shape === 'dropdown' ? 5 : 4;
    result.appendChild(move(w - 10, y, polygon({
      points: [
        7, 0,
        3.5, 4,
        0, 0,
      ],
      fill: '#000',
      opacity: '0.6',
    })));
  }
  return result;
};


/* Block */

var Block = function(info, children, comment) {
  assert(info);
  this.info = info;
  this.children = children;
  this.comment = comment || null;

  var shape = this.info.shape;
  this.isHat = shape === 'hat' || shape === 'define-hat';
  this.hasPuzzle = shape === 'stack' || shape === 'hat';
  this.isFinal = /cap/.test(shape);
  this.isCommand = shape === 'stack' || shape === 'cap' || /block/.test(shape);
  this.isOutline = shape === 'outline';
  this.isReporter = shape === 'reporter';
  this.isBoolean = shape === 'boolean';

  this.isRing = shape === 'ring';
  this.hasScript = /block/.test(shape);
  this.isElse = shape === 'celse';
  this.isEnd = shape === 'cend';

  this.x = 0;
  this.width = null;
  this.height = null;
  this.firstLine = null;
  this.innerWidth = null;
};
Block.prototype.isBlock = true;

Block.prototype.measure = function() {
  for (var i=0; i<this.children.length; i++) {
    var child = this.children[i];
    if (child.measure) child.measure();
  }
  if (this.comment) this.comment.measure();
};

Block.shapes = {
  'stack': stackRect,
  'c-block': stackRect,
  'if-block': stackRect,
  'celse': stackRect,
  'cend': stackRect,

  'cap': capRect,
  'reporter': roundedRect,
  'boolean': pointedRect,
  'hat': hatRect,
  'define-hat': procHatRect,
  'ring': roundedRect,
};

Block.prototype.drawSelf = function(w, h, lines) {
  // mouths
  if (lines.length > 1) {
    return mouthRect(w, h, this.isFinal, lines, {
      class: ['sb-' + this.info.category, 'sb-bevel'].join(' '),
    });
  }

  // outlines
  if (this.info.shape === 'outline') {
    return setProps(stackRect(w, h), {
      class: 'sb-outline',
    });
  }

  // rings
  if (this.isRing) {
    var child = this.children[0];
    if (child && (child.isInput || child.isBlock || child.isScript)) {
      var shape = child.isScript ? 'stack'
                : child.isInput ? child.shape : child.info.shape;
      return ringRect(w, h, child.y, child.width, child.height, shape, {
        class: ['sb-' + this.info.category, 'sb-bevel'].join(' '),
      });
    }
  }

  var func = Block.shapes[this.info.shape];
  assert(func, "no shape func: " + this.info.shape);
  return func(w, h, {
    class: ['sb-' + this.info.category, 'sb-bevel'].join(' '),
  });
};

Block.prototype.minDistance = function(child) {
  if (this.isBoolean) {
    return (
      child.isReporter ? 4 + child.height/4 | 0 :
      child.isLabel ? 5 + child.height/2 | 0 :
      child.isBoolean || child.shape === 'boolean' ? 5 :
      2 + child.height/2 | 0
    );
  }
  if (this.isReporter) {
    return (
      (child.isInput && child.isRound) || ((child.isReporter || child.isBoolean) && !child.hasScript) ? 0 :
      child.isLabel ? 2 + child.height/2 | 0 :
      -2 + child.height/2 | 0
    );
  }
  return 0;
};

Block.padding = {
  'hat':        [15, 6, 2],
  'define-hat': [21, 8, 9],
  'reporter':   [3, 4, 1],
  'boolean':    [3, 4, 2],
  'cap':        [6, 6, 2],
  'c-block':    [3, 6, 2],
  'if-block':   [3, 6, 2],
  'ring':       [4, 4, 2],
  null:         [4, 6, 2],
};

Block.prototype.draw = function() {
  var isDefine = this.info.shape === 'define-hat';
  var children = this.children;

  var padding = Block.padding[this.info.shape] || Block.padding[null];
  var pt = padding[0],
      px = padding[1],
      pb = padding[2];

  var y = 0;
  var Line = function(y) {
    this.y = y;
    this.width = 0;
    this.height = y ? 13 : 16;
    this.children = [];
  };

  var innerWidth = 0;
  var scriptWidth = 0;
  var line = new Line(y);
  function pushLine(isLast) {
    if (lines.length === 0) {
      line.height += pt + pb;
    } else {
      line.height += isLast ? 0 : +2;
      line.y -= 1;
    }
    y += line.height;
    lines.push(line);
  }

  if (this.info.isRTL) {
    var start = 0;
    var flip = function() {
      children = (
        children.slice(0, start).concat(
        children.slice(start, i).reverse())
        .concat(children.slice(i))
      );
    }.bind(this);
    for (var i=0; i<children.length; i++) {
      if (children[i].isScript) {
        flip();
        start = i + 1;
      }
    } if (start < i) {
      flip();
    }
  }

  var lines = [];
  for (var i=0; i<children.length; i++) {
    var child = children[i];
    child.el = child.draw(this);

    if (child.isScript && this.isCommand) {
      this.hasScript = true;
      pushLine();
      child.y = y;
      lines.push(child);
      scriptWidth = Math.max(scriptWidth, Math.max(1, child.width));
      child.height = Math.max(12, child.height) + 3;
      y += child.height;
      line = new Line(y);
    } else if (child.isArrow) {
      line.children.push(child);
    } else {
      var cmw = i > 0 ? 30 : 0; // 27
      var md = this.isCommand ? 0 : this.minDistance(child);
      var mw = this.isCommand ? (child.isBlock || child.isInput ? cmw : 0) : md;
      if (mw && !lines.length && line.width < mw - px) {
        line.width = mw - px;
      }
      child.x = line.width;
      line.width += child.width;
      innerWidth = Math.max(innerWidth, line.width + Math.max(0, md - px));
      line.width += 4;
      if (!child.isLabel) {
        line.height = Math.max(line.height, child.height);
      }
      line.children.push(child);
    }
  }
  pushLine(true);

  innerWidth = Math.max(innerWidth + px * 2,
                        this.isHat || this.hasScript ? 83 :
                        this.isCommand || this.isOutline || this.isRing ? 39 : 20);
  this.height = y;
  this.width = scriptWidth ? Math.max(innerWidth, 15 + scriptWidth) : innerWidth;
  if (isDefine) {
    var p = Math.min(26, 3.5 + 0.13 * innerWidth | 0) - 18;
    this.height += p;
    pt += 2 * p;
  }
  this.firstLine = lines[0];
  this.innerWidth = innerWidth;

  var objects = [];

  for (var i=0; i<lines.length; i++) {
    var line = lines[i];
    if (line.isScript) {
      objects.push(move(15, line.y, line.el));
      continue;
    }

    var h = line.height;

    for (var j=0; j<line.children.length; j++) {
      var child = line.children[j];
      if (child.isArrow) {
        objects.push(move(innerWidth - 15, this.height - 3, child.el));
        continue;
      }

      var y = pt + (h - child.height - pt - pb) / 2 - 1;
      if (isDefine && child.isLabel) {
        y += 3;
      } else if (child.isIcon) {
        y += child.dy | 0;
      }
      if (this.isRing) {
        child.y = line.y + y|0;
        if (child.isInset) {
          continue;
        }
      }
      objects.push(move(px + child.x, line.y + y|0, child.el));
    }
  }

  var el = this.drawSelf(innerWidth, this.height, lines);
  objects.splice(0, 0, el);
  if (this.info.color) {
    setProps(el, {
      fill: this.info.color,
    });
  }

  return group(objects);
};


/* Comment */

var Comment = function(value, hasBlock) {
  this.label = new Label(value, ['sb-comment-label']);
  this.width = null;
  this.hasBlock = hasBlock;
};
Comment.prototype.isComment = true;
Comment.lineLength = 12;
Comment.prototype.height = 20;

Comment.prototype.stringify = function() {
  return "// " + this.label.value;
};

Comment.prototype.measure = function() {
  this.label.measure();
};

Comment.prototype.draw = function() {
  var labelEl = this.label.draw();

  this.width = this.label.width + 16;
  return group([
    commentLine(this.hasBlock ? Comment.lineLength : 0, 6),
    commentRect(this.width, this.height, {
      class: 'sb-comment',
    }),
    move(8, 4, labelEl),
  ]);
};


/* Script */

var Script = function(blocks) {
  this.blocks = blocks;
  this.isEmpty = !blocks.length;
  this.isFinal = !this.isEmpty && blocks[blocks.length - 1].isFinal;
  this.y = 0;
};
Script.prototype.isScript = true;

Script.prototype.measure = function() {
  for (var i=0; i<this.blocks.length; i++) {
    this.blocks[i].measure();
  }
};

Script.prototype.draw = function(inside) {
  var children = [];
  var y = 0;
  this.width = 0;
  for (var i=0; i<this.blocks.length; i++) {
    var block = this.blocks[i];
    children.push(move(inside ? 0 : 2, y, block.draw()));
    y += block.height;
    this.width = Math.max(this.width, block.width);

    var comment = block.comment;
    if (comment) {
      var line = block.firstLine;
      var cx = block.innerWidth + 2 + Comment.lineLength;
      var cy = y - block.height + (line.height / 2);
      var el = comment.draw();
      children.push(move(cx, cy - comment.height / 2, el));
      this.width = Math.max(this.width, cx + comment.width);
    }
  }
  this.height = y;
  if (!inside && !this.isFinal) {
    this.height += 3;
  }
  return group(children);
};


/* Document */

var Document = function(scripts) {
  this.scripts = scripts;

  this.width = null;
  this.height = null;
  this.el = null;
};

Document.prototype.measure = function() {
  this.scripts.forEach(function(script) {
    script.measure();
  });
};

Document.prototype.render = function(cb) {
  // measure strings
  this.measure();

  // finish measuring & render
  Label.endMeasuring(this.drawScripts.bind(this, cb));
};

Document.prototype.drawScripts = function(cb) {
  // render each script
  var width = 0;
  var height = 0;
  var elements = [];
  for (var i=0; i<this.scripts.length; i++) {
    var script = this.scripts[i];
    if (height) height += 10;
    script.y = height;
    elements.push(move(0, height, script.draw()));
    height += script.height;
    width = Math.max(width, script.width + 4);
  }
  this.width = width;
  this.height = height;

  // return SVG
  var svg = newSVG(width, height);
  svg.appendChild(withChildren(el('defs'), [
      bevelFilter('bevelFilter', false),
      bevelFilter('inputBevelFilter', true),
      darkFilter('inputDarkFilter'),
  ].concat(makeIcons())));

  svg.appendChild(group(elements));
  this.el = svg;
  cb(svg);
};

Document.prototype.exportSVG = function() {
  assert(this.el, "call draw() first");

  var style = makeStyle();
  this.el.appendChild(style);
  var xml = new XMLSerializer().serializeToString(this.el);
  this.el.removeChild(style);

  return 'data:image/svg+xml;utf8,' + xml.replace(
    /[#]/g, encodeURIComponent
  );
}

Document.prototype.exportPNG = function(cb) {
  var canvas = document.createElement('canvas');
  canvas.width = this.width;
  canvas.height = this.height;
  var context = canvas.getContext("2d");

  var image = new Image;
  image.src = this.exportSVG();
  image.onload = function() {
    context.drawImage(image, 0, 0);

    if (URL && URL.createObjectURL && Blob && canvas.toBlob) {
      var blob = canvas.toBlob(function(blob) {
        cb(URL.createObjectURL(blob));
      }, 'image/png');
    } else {
      cb(canvas.toDataURL('image/png'));
    }
  };
}

/*****************************************************************************/

function div(tagName, className) {
  var d = document.createElement(className ? tagName : 'div');
  d.className = className || tagName || '';
  return d;
}


// add our CSS to the page
document.head.appendChild(makeStyle());

class Workspace {
  constructor() {
    this.elContents = newSVG(1000, 1000);
    this.elContents.appendChild(withChildren(el('defs'), [
        bevelFilter('bevelFilter', false),
        bevelFilter('inputBevelFilter', true),
        darkFilter('inputDarkFilter'),
    ]));

    this.el = div('workspace no-select');
    this.el.appendChild(this.elContents);

    var b = new Block({shape: 'stack', category: 'motion'}, [new Label('four')]);
    b.measure();
    Label.endMeasuring(() => {
      var el = b.draw();
      this.elContents.appendChild(el);
      app.nodes.set(el, b);
    });

    var b2 = new Block({shape: 'stack', category: 'looks'}, [new Label('party party')]);
    b2.measure();
    Label.endMeasuring(() => {
      var el = b2.draw();
      move(100, 0, el);
      this.elContents.appendChild(el);
      app.nodes.set(el, b2);
    });

    var input = div('input', 'asdf');
    input.value = 'asdf';
    this.elContents.appendChild(embedHTML(50, 100, input));

    this.el.addEventListener('scroll', this.scrolled.bind(this));
  }

  scrolled(e) {
    this.scrollX = this.el.scrollLeft;
    this.scrollY = this.el.scrollTop;
  }

  resize(width, height) {
    this.screenWidth = width;
    this.screenHeight = height;
    // this.el.style.width = width + 'px';
    // this.el.style.height = height + 'px';
  }
}

class World extends Workspace {
  constructor() {
    super();
    this.el.className += ' world';

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
  }

  toScreen(x, y) {
    return {
      x: (point.x - this.bounds.left) * this.zoom,
      y: (this.bounds.top - point.y) * this.zoom,
    };
  };

  fromScreen(x, y) {
    return {
      x: (x / this.zoom) + this.bounds.left,
      y: -((y / this.zoom) - this.bounds.top),
    };
  };

  get isScrollable() {
    return true;
  }

  resize(width, height) {
    super.resize(width, height);
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
      this.scrollBy(this.inertiaX, this.inertiaY);
      this.inertiaX *= 0.95;
      this.inertiaY *= 0.95;
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
      left: this.scrollX - (this.screenWidth / 2) / this.zoom | 0,
      right: this.scrollX + (this.screenWidth / 2) / this.zoom | 0,
      bottom: this.scrollY - (this.screenHeight / 2) / this.zoom | 0,
      top: this.scrollY + (this.screenHeight / 2) / this.zoom | 0,
    };
  }

  transform() {
    this.elContents.style.transform = `scale(${this.zoom}) translate(${-this.bounds.left}px, ${-this.bounds.top}px)`;
  }
}

class Palette extends Workspace {
  constructor() {
    super();
    this.el.className += ' palette';

    setProps(this.elContents, {
      width: 2000,
    });

  }
}


/*****************************************************************************/

class App {
  constructor() {
    this.el = div('app');
    this.workspaces = [];

    this.world = new World(this.elWorld = div(''));
    this.palette = new Palette(this.elPalette = div(''));
    this.workspaces = [this.world]; //, this.palette];
    this.el.appendChild(this.world.el);
    this.el.appendChild(this.palette.el);

    this.nodes = new Map();
    this.nodes.set(this.world.el, this.world);

    this.resize();

    document.body.appendChild(this.el);
    document.body.appendChild(this.elScripts = div('absolute dragging'));

    this.fingers = [];
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

  resize(e) {
    for (let w of this.workspaces) {
      w.resize(w.el.clientWidth, w.el.clientHeight);
    }
  }

  wheel(e) {
    // TODO trackpad should scroll vertically; mouse scroll wheel should zoom!
    var w = this.workspaceFromElement(e.target);
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
    return this.fingers[id] = {}; // new finger
  }

  destroyFinger(id) {
    var g = id === this ? this : this.fingers[id];
    if (g) {
      if (g.dragging) this.drop(g);

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

  objectFromElement(t) {
    while (t) {
      var o = this.nodes.get(t);
      if (o) return o;
      t = t.parentNode;
    }
    return null;
  }

  workspaceFromElement(t) {
    var workspaceEls = this.workspaces.map(w => w.el);
    while (t) {
      var index = workspaceEls.indexOf(t);
      if (index !== -1) return this.workspaces[index];
      t = t.parentNode;
    }
    return null;
  }

  fingerDown(p, e) {
    var g = this.createFinger(p.identifier);
    g.pressX = g.mouseX = p.clientX;
    g.pressY = g.mouseY = p.clientY;
    g.pressObject = this.objectFromElement(e.target);
    console.log(g.pressObject);
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

    if (g.dragging) {
    } else if (g.scrolling) {
      e.preventDefault();
    } else if (g.pressed && g.shouldDrag) {
    } else if (g.pressed && g.shouldScroll) {
      g.scrolling = true;
      g.scrollX = g.pressX;
      g.scrollY = g.pressY;
    }

    if (g.scrolling) {
      g.pressObject.fingerScroll(g.mouseX - g.scrollX, g.mouseY - g.scrollY)
      g.scrollX = g.mouseX;
      g.scrollY = g.mouseY;
      e.preventDefault();
    }
  }

  fingerUp(p, e) {
    var g = this.getFinger(p.identifier);

    if (g.scrolling) {
      g.pressObject.fingerScrollEnd();
    }

    // TODO

    this.destroyFinger(p.identifier);
  }


}

var app = new App();

