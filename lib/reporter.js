'use strict';

var utils = require('./utils');
var fs = require('fs');
var SpeedTest = require('myspeed').Client;

var SPEEDTEST_URL = 'ws://speedofme.storj.io';

module.exports.report = function(reporter, config, farmer) {
  var speedTestResultPath = utils.getSpeedTestResultPath(
    farmer._keypair.getNodeID()
  );
  var bandwidth = fs.existsSync(speedTestResultPath) ?
                  fs.readFileSync(speedTestResultPath).toString() :
                  null;
  var needstest = false;
  var hours25 = 60 * 60 * 25 * 1000;

  function send() {
    utils.getDirectorySize(config.storage.path, function(err, size) {
      if (err) {
        return;
      }

      var totalSpace = Number(config.storage.size);

      switch (config.storage.unit) {
        case 'MB':
          totalSpace = totalSpace * Math.pow(1024, 2);
          break;
        case 'GB':
          totalSpace = totalSpace * Math.pow(1024, 3);
          break;
        case 'TB':
          totalSpace = totalSpace * Math.pow(1024, 4);
          break;
        default:
          // NOOP
      }

      var report = {
        storage: {
          free: Number((totalSpace - size).toFixed()),
          used: Number(size.toFixed())
        },
        bandwidth: {
          upload: bandwidth ? Number(bandwidth.upload) : 0,
          download: bandwidth ? Number(bandwidth.download) : 0
        },
        contact: farmer._contact,
        payment: config.address
      };

      process.stdout.write(JSON.stringify({type: 'info',
          message: 'telemetry report ' + JSON.stringify(report),
          timestamp: new Date()
        }) + '\n');

      reporter.send(report, function(err, report) {
        process.stdout.write(JSON.stringify({
          type: err ? 'error' : 'info',
          message: err ? err.message :
                         'sent telemetry report ' + JSON.stringify(report),
          timestamp: new Date()
        }) + '\n');
      });
    });

    setTimeout(function() {
      module.exports.report(reporter, config, farmer);
    }, 5 * (60 * 1000));
  }

  if (!bandwidth) {
    needstest = true;
  } else {
    bandwidth = JSON.parse(bandwidth);

    if ((new Date() - new Date(bandwidth.timestamp)) > hours25) {
      needstest = true;
    }
  }

  if (needstest && SPEEDTEST_URL) {
    SpeedTest({ url: SPEEDTEST_URL }).test(function(err, result) {
      if (err) {
        return process.stdout.write(JSON.stringify({
          type: 'error',
          message: err.message,
          timestamp: new Date()
        }) + '\n');
      }

      bandwidth = {
        upload: result.upload,
        download: result.download,
        timestamp: Date.now()
      };

      fs.writeFileSync(speedTestResultPath, JSON.stringify(bandwidth));
      send();
    });
  } else {
    send();
  }
};
