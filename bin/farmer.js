#!/usr/bin/env node

'use strict';

var crypto = require('crypto');
var base58 = require('bs58');
var fs = require('fs');
var path = require('path');
var async = require('async');
var program = require('commander');
var FarmerFactory = require('storj-farmer').FarmerFactory;
var storj = require('storj-farmer/node_modules/storj');
var platform = require('os').platform();
var prompt = require('prompt');
var url = require('url');
var colors = require('colors/safe');

var HOME = platform !== 'win32' ? process.env.HOME : process.env.USERPROFILE;
var CONFNAME = 'config.json';

prompt.message = colors.white.bold(' STORJ-FARMER-CLI');
prompt.delimiter = colors.blue(' >> ');

program
  .version(storj.version)
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
  .option(
    '-t, --testnet <postfix>',
    'Postfix the version identifier to partition the network',
    ''
  )
  .parse(process.argv);

var schema = {
  properties: {
    address: {
      description: 'Enter your public hostname or IP address',
      required: true,
      default: FarmerFactory.DEFAULTS.network.address,
    },
    port: {
      description: 'Enter the port number the service should use (0 for random)',
      required: false,
      type: 'number',
      default: FarmerFactory.DEFAULTS.network.port,
      conform: function(value) {
        return (value > -1) && (value <= 65535);
      }
    },
    forward: {
      description: 'Use NAT traversal strategies to become available on the network',
      required: true,
      type: 'boolean',
      default: FarmerFactory.DEFAULTS.network.forward
    },
    seed: {
      description: 'Enter the URI of a known seed',
      required: false,
      default: FarmerFactory.DEFAULTS.network.seeds[0],
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
      default: FarmerFactory.DEFAULTS.storage.size + FarmerFactory.DEFAULTS.storage.unit,
      message: 'Invalid format supplied, try 50MB, 2GB, or 1TB',
      conform: function(value) {
        var size = parseInt(value);
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
      default: FarmerFactory.DEFAULTS.telemetry.enabled,
      type: 'boolean'
    },
    keypath: {
      description: 'Enter the path to store your encrypted private key',
      required: true,
      default: path.join(program.datadir || path.join(HOME, '.storj-farmer-cli'), 'id_ecdsa'),
      message: 'Cannot write key to path that does not exist',
      conform: function(value) {
        return fs.existsSync(path.dirname(value));
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
  getDirectorySize(config.storage.path, function(err, size) {
    if (err) {
      return;
    }

    reporter.send({
      storage: {
        free: config.storage.size,
        used: size
      },
      bandwidth: {
        upload: 12, // TODO: Measure this.
        download: 32 // TODO: Measure this.
      },
      contact: farmer._contact,
      payment: config.address
    }, function(/* err, result */) {
      // TODO: Handle result
    });
  });

  setTimeout(report, 5 * (60 * 1000));
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

    var farmerconf = {
      key: privkey,
      address: config.address,
      storage: {
        path: datadir,
        size: config.storage.size,
        unit: config.storage.unit
      },
      network: {
        address: config.network.address,
        port: config.network.port,
        seeds: config.network.seeds,
        version: program.testnet ?
                 storj.version + '-' + program.testnet :
                 storj.version,
        forward: config.network.forward
      },
      telemetry: {
        enabled: config.telemetry.enabled
      }
    };

    FarmerFactory.create(farmerconf, function(err, farmer) {
      if (err) {
        console.log(err);
        process.exit();
      }

      farmer.logger.pipe(process.stdout);

      farmer.node.join(function(err) {
        if (err) {
          console.log(err);
          process.exit();
        }
      });

      if (farmer.reporter) {
        report(farmer.reporter, config, farmer.node);
      }
    });
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

    var size = parseInt(result.space);
    var unit = result.space.split(size.toString())[1];

    var config = {
      keypath: result.keypath,
      address: result.payto,
      storage: {
        path: program.datadir,
        size: size,
        unit: unit
      },
      network: {
        address: result.address,
        port: result.port,
        seeds: [result.seed],
        opcodes: ['01020202', '02020202', '03020202'],
        forward: result.forward
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
