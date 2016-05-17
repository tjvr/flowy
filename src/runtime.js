
var old = [
  
    // {}  -> Block

    // let _:Word := _:Expr
    // 'T     <- Word

    // 'T Var <- var _:Word
    //           var _:Word := _value:Expr
    // 'T     <- _:Var                     // TODO variable types
    //           _:Var := _:Expr

    // show _:Expr

    "Int <: Expr",
    // ["_:NumberToken",     "Int",  "BigInteger.parseInt(_1)"],
    ["int _:Str",         "Int",  "+BigInteger.toStr(_1)"],
    ["_:Int + _:Int",     "Int",  "BigInteger.add(_1, _2)"],
    ["_:Int - _:Int",     "Int",  "BigInteger.subtract(_1, _2)"],
    ["_:Int × _:Int",     "Int",  "BigInteger.multiply(_1, _2)"],
    ["_:Int ÷ _:Int",     "Int",  "BigInteger.divide(_1, _2)"],
    ["_:Int mod _:Int",   "Int",  "BigInteger.remainder(_1, _2)"],
    ["_:Int < _:Int",     "Bool", "(BigInteger.compareTo(_1, _2) === -1)"],
    ["_:Int = _:Int",     "Bool", "(BigInteger.compareTo(_1, _2) === 0)"],
    ["_:Int > _:Int",     "Bool", "(BigInteger.compareTo(_1, _2) === +1)"],
    ["str _:Int",         "Str",  "BigInteger.toStr(_1)"],
    "",

    "Float <: Expr",
    // ["_:FloatToken",        "Float",  "+_1"],
    // ["float _:Str",         "Float",  "+_1"],
    // ["float _:Int",         "Float",  "+BigInteger.toStr(_1)"],
    ["_:Float + _:Float",   "Float",  "(_1 + _2)"],
    ["_:Float - _:Float",   "Float",  "(_1 - _2)"],
    ["_:Float × _:Float",   "Float",  "(_1 * _2)"],
    ["_:Float ÷ _:Float",   "Float",  "(_1 / _2)"],
    ["_:Float mod _:Float", "Float",  "(((_1 % _2) + _2) % _2)"],
    ["_:Float < _:Float",   "Bool",   "(_1 < _2)"],
    ["_:Float = _:Float",   "Bool",   "(_1 === _2)"],
    ["_:Float > _:Float",   "Bool",   "(_1 > _2)"],
    // ["str _:Float",         "Str",  "('' + _1)"],
    "",

    "Bool <: Expr",
    ["true",                "Bool",   "true"],
    ["false",               "Bool",   "false"],
    ["_:Bool = _:Bool",     "Bool",   "(_1 === _2)"],
    ["not _:Bool",          "Bool",   "!_1"],
    ["_:Bool and _:Bool",   "Bool",   "(_1 && _2)"],
    ["_:Bool or _:Bool",    "Bool",   "(_1 || _2)"],
    "",

    "Str <: Expr",
    // Str <- _:StringToken
    ["_:Str = _:Str",           "Bool",     "(_1 === _2)"],
    ["join *_:Str",             "Str",      "_1.join('')"],
    ["join *_:Str with _:Str",  "Str",      "_1.join(_2)"],
    ["split _:Str by *_:Str",   "Str List", "_1.split(_2)"],
    "",

    "List <: Expr",
    ["list *_:Expr",                  "List",   "_1"],
    ["item _:Int of _:List",              "Expr",    "_1[_2] === undefined ? raise('IndexError') : _1[_2]"],
    ["_:List concat _:List",          "List",   "_1.concat(_2)"],
    ["map _:Block over _:List",       "List",   "_2.map(_1)"],
    ["keep _:Block from _:List",      "List",   "_2.filter(_1)"],
    ["combine _:List with _:Block",   "List",   "_1.reduce(_2)"],
    ["is _:List empty?",              "Bool",   "_1.length === 0"],
    "",

    ["add _item:Expr to _v:(List Var)",                      "Line", "v.push(item);"], // make variadic
    ["insert _item:Expr at _index:Int of _v:(List Var)",     "Line", "v.value.splice(index, 0, item);"], // make variadic. Fix
    ["replace _index:Int of _v:(List Var) with _item:Expr",  "Line", "if (v.value[index] === undefined) raise('IndexError'); v.value[index] = item;"],
    ["delete first of _v:(List Var)",                       "Line", "v.shift();"],
    ["delete last of _v:(List Var)",                        "Line", "v.pop();"],
    ["delete _index:Int of _v:(List Var)",                  "Line", "if (v.value[index] === undefined) raise('IndexError'); v.value.splice(index, 1);"],
    "",

    // ["str _:Expr",                         "Expr",  "('' + _1)"],
    ["if _:Bool then _:Expr else _:Expr",  "Expr",  "(_1 ? _2 : _3)"],
    "",

    // ["_:Block",                               "Line", "_1;"],
    // ["if _:Bool then _:Block else _:Block",   "Line", "if (_1) {\n_2();\n} else {\n_3();\n};"], // elif?
    ["repeat _:Int _:Block",                  "Line", "var __end = _1; for (var i=0; i<__end; i++) {\n_2();\n};"], // TODO gensym
    ["repeat until _:Bool _:Block",           "Line", "while (!_1) {\n_2();\n};"],
    ["for each _:Var of _:List _:Block",      "Line", "_2.forEach(_3.bind(null, _1));"],
    "",

    ["input",      "Int", "123"],
    ["return _:Int",      "Int", "123"],
    ["fib of _:Int",      "Int", "123"],

];

/*
var donePrims = new Map();
var paletteContents = primitives.map(function(prim) {
  if (typeof prim === 'string') return;
  let [spec, type, js] = prim;
  var words = spec.split(/ |(_[a-z]*:\([^)]+\))/g).filter(x => x);

  var hash = words.map(word => {
    return word.split(/:/)[0];
  }).join(" ");
  if (donePrims.has(hash)) return;
  donePrims.set(hash, true);

  var parts = words.map(word => {
    if (/:|^_/.test(word)) {
      var value = "";
      return new Input(value)
    } else {
      return new Label(word);
    }
  });
  return new Node({}, parts);
}).filter(x => !!x);
*/

class RecordType {
  constructor(fields) {
    this.fields = fields;
  }


}

import {BigInteger} from "js-big-integer";
//var BigInteger = yaffle.BigInteger

var imm = function(f) {
  return (args, cb) => {
    cb(f.apply(null, args));
  };
};

function isInt(x) {
  return (x && x.constructor === BigInteger) || /-?[0-9]+/.test(''+x);
}

function Float(x) {
  if (isInt(x)) {
    return +x.toString();
  } else {
    return +x;
  }
}

function infixMath(name, op) {
  var BI = BigInteger;
  return imm(eval(`(function(a, b) {
    if (isInt(a) && isInt(b)) {
      return BI.${name}(a, b);
    } else {
      var x = Float(a);
      var y = Float(b);
      return ${op};
    }
  })`));
}

export const primitives = {
  "_ + _": infixMath('add', 'x + y'),
  "_ - _": infixMath('subtract', 'x - y'),
  "_ × _": infixMath('multiply', 'x * y'),
  "_ ÷ _": infixMath('divide', 'x / y'),
  "_ mod _": infixMath('remainder', '(((x % y) + y) % y)'),
};

export const literal = value => {
  if (/^-?[0-9]+$/.test(value)) {
    return BigInteger.parseInt(value);
  } else {
    var n = +value;
    if (''+n !== 'NaN') {
      return n;
    }
  }
  return value;
};

