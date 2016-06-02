'use strict';

var path = require('path');
var fs = require('fs');
var async = require('async');
var crypto = require('crypto');
var base58 = require('bs58');

module.exports.opcodeUpdate = function(opcode) {
  if (Buffer(opcode, 'hex')[0] !== 0xf) {
    return '0f' + opcode;
  } else {
    return opcode;
  }
};

module.exports.getSpeedTestResultPath = function(nodeid) {
  return path.join(
    require('os').tmpdir(),
    'speedtest-' + nodeid + '.json'
  );
};

module.exports.getDirectorySize = function(dir, callback) {
  fs.stat(dir, function(err, stats) {
    if (err || !stats.isDirectory()) {
      return callback(err, 0);
    }

    var total = stats.size;

    function done(err) {
      callback(err, total);
    }

    fs.readdir(dir, function(err, list) {
      if (err) {
        return callback(err);
      }

      async.each(list, function(diritem, next) {
        var child = path.join(dir, diritem);

        module.exports.getDirectorySize(child, function(err, size) {
          total = total + size;
          next(err);
        });
      }, done);
    });
  });
};

module.exports.encrypt = function(password, str) {
  var aes256 = crypto.createCipher('aes-256-cbc', password);
  var a = aes256.update(str, 'utf8');
  var b = aes256.final();
  var buf = new Buffer(a.length + b.length);

  a.copy(buf, 0);
  b.copy(buf, a.length);

  return base58.encode(buf);
};

module.exports.decrypt = function(password, str) {
  var aes256 = crypto.createDecipher('aes-256-cbc', password);
  var a = aes256.update(new Buffer(base58.decode(str)));
  var b = aes256.final();
  var buf = new Buffer(a.length + b.length);

  a.copy(buf, 0);
  b.copy(buf, a.length);

  return buf.toString('utf8');
};
