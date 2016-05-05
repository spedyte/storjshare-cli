#!/usr/bin/env node

'use strict';

var crypto = require('crypto');
var base58 = require('bs58');
var fs = require('fs');
var path = require('path');
var async = require('async');
var program = require('commander');
var storj = require('storj');
var SpeedTest = require('myspeed').Client;
var platform = require('os').platform();
var prompt = require('prompt');
var url = require('url');
var colors = require('colors/safe');
var Logger = require('kad-logger-json');
var TelemetryReporter = require('storj-telemetry-reporter');

var HOME = platform !== 'win32' ? process.env.HOME : process.env.USERPROFILE;
var CONFNAME = 'config.json';
var SPEEDTEST_URL = 'ws://speedofme.storj.io';
var SPEEDTEST_RESULT_PATH = path.join(require('os').tmpdir(), 'speedtest.json');

prompt.message = colors.white.bold(' STORJ-FARMER-CLI');
prompt.delimiter = colors.blue(' >> ');

program
  .version(
    'Farmer: v' + require('../package').version + '\n' +
    'Core:   v' + storj.version
  )
  .option(
    '-d, --datadir [path]',
    'Set configuration and storage path',
    path.join(HOME, '.storj-farmer-cli')
  )
  .option(
    '-p, --password [password]',
    'Password to unlock your private key',
    ''
  )
  .parse(process.argv);

var schema = {
  properties: {
    address: {
      description: 'Enter your public hostname or IP address',
      required: true,
      default: storj.Network.DEFAULTS.address,
    },
    port: {
      description: 'Enter the TCP port number the service should use (0 for random)',
      required: false,
      type: 'number',
      default: storj.Network.DEFAULTS.port,
      conform: function(value) {
        return (value > -1) && (value <= 65535);
      }
    },
    forward: {
      description: 'Use NAT traversal strategies to become available on the network',
      required: true,
      type: 'boolean',
      default: storj.Network.DEFAULTS.forward
    },
    seed: {
      description: 'Enter the URI of a known seed',
      required: false,
      default: storj.Network.DEFAULTS.seeds[0],
      message: 'Invalid seed URI supplied, make sure the nodeID is correct',
      conform: function(value) {
        var parsed = url.parse(value);
        var proto = parsed.protocol === 'storj:';
        var nodeid = parsed.path.substr(1).length === 40;
        var address = parsed.hostname && parsed.port;

        return proto && nodeid && address;
      }
    },
    datadir: {
      description: 'Enter the path to store configuration and data',
      required: true,
      default: program.datadir,
      message: 'Directory already exists, refusing to overwrite',
      conform: function(value) {
        if (fs.existsSync(value)) {
          return false;
        }
        fs.mkdirSync(value);
        return true;
      }
    },
    space: {
      description: 'Enter the amount of storage space you can share',
      required: true,
      default: '2GB',
      message: 'Invalid format supplied, try 50MB, 2GB, or 1TB',
      conform: function(value) {
        var size = parseFloat(value);
        var unit = value.split(size)[1];

        return size && (['MB','GB','TB'].indexOf(unit) !== -1);
      }
    },
    payto: {
      description: 'Enter a payment address to receive rewards (telemetry must be enabled)',
      required: false
    },
    telemetry: {
      description: 'Will you share telemetry data with Storj to help improve the network?',
      required: true,
      default: false,
      type: 'boolean'
    },
    tunnels: {
      description: 'Enter the number of tunnel connection other farmer can open through you',
      required: true,
      type: 'number',
      default: storj.Network.DEFAULTS.tunnels,
      conform: function(value) {
        return (value > -1);
      }
    },
    tunnelport: {
      description: 'Enter the TCP port number the tunnel server should use (0 for random)',
      required: true,
      type: 'number',
      default: storj.Network.DEFAULTS.tunport,
      conform: function(value) {
        return (value > -1) && (value <= 65535);
      }
    },
    gatewaysmin: {
      description: 'Enter the start TCP port for tunnel connections (0 for random)',
      required: true,
      type: 'number',
      default: storj.Network.DEFAULTS.gateways.min,
      conform: function(value) {
        return (value > -1) && (value <= 65535);
      }
    },
    gatewaysmax: {
      description: 'Enter the end TCP port for tunnel connections (0 for random)',
      required: true,
      type: 'number',
      default: storj.Network.DEFAULTS.gateways.max,
      conform: function(value) {
        return (value > -1) && (value <= 65535);
      }
    },
    keypath: {
      description: 'Enter the path to store your encrypted private key',
      required: true,
      default: path.join(program.datadir || path.join(HOME, '.storj-farmer-cli'), 'id_ecdsa'),
      message: 'Refusing to overwrite the supplied path',
      conform: function(value) {
        return fs.existsSync(path.dirname(value)) &&
               !fs.existsSync(value);
      }
    },
    password: {
      description: 'Enter a password to protect your private key',
      hidden: true,
      replace: '*',
      required: true
    }
  }
};

var keypass = {
  properties: {
    password: {
      description: 'Unlock your private key to start storj',
      hidden: true,
      replace: '*',
      required: true
    }
  }
};

function getDirectorySize(dir, callback) {
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

        getDirectorySize(child, function(err, size) {
          total = total + size;
          next(err);
        });
      }, done);
    });
  });
}

function encrypt(password, str) {
  var aes256 = crypto.createCipher('aes-256-cbc', password);
  var a = aes256.update(str, 'utf8');
  var b = aes256.final();
  var buf = new Buffer(a.length + b.length);

  a.copy(buf, 0);
  b.copy(buf, a.length);

  return base58.encode(buf);
}

function decrypt(password, str) {
  var aes256 = crypto.createDecipher('aes-256-cbc', password);
  var a = aes256.update(new Buffer(base58.decode(str)));
  var b = aes256.final();
  var buf = new Buffer(a.length + b.length);

  a.copy(buf, 0);
  b.copy(buf, a.length);

  return buf.toString('utf8');
}

function report(reporter, config, farmer) {
  var bandwidth = fs.existsSync(SPEEDTEST_RESULT_PATH) ?
                  fs.readFileSync(SPEEDTEST_RESULT_PATH).toString() :
                  null;
  var needstest = false;
  var hours25 = 60 * 60 * 25 * 1000;

  function send() {
    getDirectorySize(config.storage.path, function(err, size) {
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
          free: totalSpace,
          used: size
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
      report(reporter, config, farmer);
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

      fs.writeFileSync(SPEEDTEST_RESULT_PATH, JSON.stringify(bandwidth));
      send();
    });
  } else {
    send();
  }
}

function opcodeUpdate(opcode) {
  if (Buffer(opcode, 'hex')[0] !== 0xf) {
    return '0f' + opcode;
  } else {
    return opcode;
  }
}

function start(datadir) {
  if (!fs.existsSync(datadir)) {
    console.log('The supplied datadir does not exist');
    process.exit();
  }

  if (!fs.existsSync(path.join(datadir, CONFNAME))) {
    console.log('No storj configuration found in datadir');
    process.exit();
  }

  var config = JSON.parse(
    fs.readFileSync(path.join(datadir, CONFNAME)).toString()
  );
  var privkey = fs.readFileSync(config.keypath).toString();

  function open(passwd, privkey) {
    try {
      privkey = decrypt(passwd, privkey);
    } catch (err) {
      console.log('Failed to unlock private key - incorrect password');
      process.exit();
    }

    var keypair = storj.KeyPair(privkey);
    var farmerconf = {
      keypair: keypair,
      payment: config.address,
      storage: {
        path: datadir,
        size: config.storage.size,
        unit: config.storage.unit
      },
      address: config.network.address,
      port: config.network.port,
      seeds: config.network.seeds,
      noforward: !config.network.forward,
      logger: new Logger(),
      tunport: config.network.tunnelport,
      tunnels: config.network.tunnels,
      gateways: config.network.gateways,
      opcodes: !Array.isArray(config.network.opcodes) ?
               storj.FarmerInterface.DEFAULTS.opcodes :
               config.network.opcodes.map(opcodeUpdate)
    };

    farmerconf.logger.pipe(process.stdout);

    var farmer = new storj.FarmerInterface(farmerconf);

    farmer.join(function(err) {
      if (err) {
        console.log(err);
        process.exit();
      }
    });

    if (config.telemetry.enabled) {
      try {
        report(TelemetryReporter(
          'https://status.storj.io',
          keypair
        ), config, farmer);
      } catch (err) {
        farmerconf.logger.error(
          'telemetry reporter failed, reason: %s', err.message
        );
      }
    }
  }

  if (program.password) {
    open(program.password, privkey);
  } else {
    prompt.start();
    prompt.get(keypass, function(err, result) {
      if (err) {
        return console.log(err);
      }

      open(result.password, privkey);
    });
  }
}

if (!fs.existsSync(program.datadir)) {
  console.log('\n Let\'s setup your Storj configuration!\n');

  prompt.start();

  prompt.get(schema, function(err, result) {
    if (err) {
      return console.log(err);
    }

    var size = parseFloat(result.space);
    var unit = result.space.split(size.toString())[1];

    var config = {
      keypath: result.keypath,
      address: result.payto,
      storage: {
        path: result.datadir,
        size: size,
        unit: unit
      },
      network: {
        address: result.address,
        port: result.port,
        seeds: [result.seed],
        opcodes: ['0f01020202', '0f02020202', '0f03020202'],
        forward: result.forward,
        tunnels: result.tunnels,
        tunnelport: result.tunnelport,
        gateways: { min: result.gatewaysmin, max: result.gatewaysmax }
      },
      telemetry: {
        service: 'https://status.storj.io',
        enabled: result.telemetry
      }
    };

    fs.writeFileSync(
      path.join(result.datadir, CONFNAME),
      JSON.stringify(config, null, 2)
    );

    fs.writeFileSync(
      config.keypath,
      encrypt(result.password, storj.KeyPair().getPrivateKey())
    );

    start(result.datadir);
  });
} else {
  start(program.datadir);
}
