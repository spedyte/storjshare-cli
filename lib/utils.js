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
    if (err) {
      if (err.code == "ENOENT") {
        // This file has been removed during size calculation.
        return callback(null, 0);
      }
      return callback(err, 0);
    }

    var total = stats.size;

    if (!stats.isDirectory()) {
      return callback(err, total);
    }
    
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
