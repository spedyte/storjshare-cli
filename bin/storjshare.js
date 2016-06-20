#!/usr/bin/env node

'use strict';

var fs = require('fs');
var path = require('path');
var program = require('commander');
var storj = require('storj');
var platform = require('os').platform();
var prompt = require('prompt');
var colors = require('colors/safe');
var Logger = require('kad-logger-json');
var WizardSchema = require('../lib/wizard-schema');
var UnlockSchema = require('../lib/unlock-schema');
var TelemetryReporter = require('storj-telemetry-reporter');
var reporter = require('../lib/reporter');
var utils = require('../lib/utils');
var log = require('../lib/logger');

var HOME = platform !== 'win32' ? process.env.HOME : process.env.USERPROFILE;
var CONFNAME = 'config.json';

prompt.message = colors.bold.cyan(' [...]');
prompt.delimiter = colors.cyan('  > ');

program.version(
  'StorjShare: ' + require('../package').version + '\n' +
  'Core:       ' + storj.version.software + '\n' +
  'Protocol:   ' + storj.version.protocol
);

var ACTIONS = {
  start: function start(env) {
    if (!fs.existsSync(env.datadir)) {
      log(
        'error',
        'The datadir does not exist, run: storjshare setup --datadir %s',
        [env.datadir]
      );
      process.exit();
    }

    if (!fs.existsSync(path.join(env.datadir, CONFNAME))) {
      log(
        'error',
        'No configuration found in datadir, run: storjshare setup --datadir %s',
        [env.datadir]
      );
      process.exit();
    }

    var config = JSON.parse(
      fs.readFileSync(path.join(env.datadir, CONFNAME)).toString()
    );
    var privkey = fs.readFileSync(config.keypath).toString();

    function open(passwd, privkey) {
      try {
        privkey = storj.utils.simpleDecrypt(passwd, privkey);
      } catch (err) {
        log('error', 'Failed to unlock private key, incorrect password');
        process.exit();
      }

      var keypair = storj.KeyPair(privkey);
      var farmerconf = {
        keypair: keypair,
        payment: { address: config.address },
        storage: {
          path: env.datadir,
          size: config.storage.size,
          unit: config.storage.unit
        },
        address: config.network.address,
        concurrency: !config.network.concurrency ?
                     storj.FarmerInterface.DEFAULTS.concurrency :
                     config.network.concurrency,
        port: config.network.port,
        seeds: config.network.seeds,
        noforward: !config.network.forward,
        logger: new Logger(config.loglevel),
        tunport: config.network.tunnelport,
        tunnels: config.network.tunnels,
        gateways: config.network.gateways,
        opcodes: !Array.isArray(config.network.opcodes) ?
                 storj.FarmerInterface.DEFAULTS.opcodes :
                 config.network.opcodes.map(utils.opcodeUpdate)
      };

      farmerconf.logger.pipe(process.stdout);

      var farmer = new storj.FarmerInterface(farmerconf);

      farmer.join(function(err) {
        if (err) {
          log('error', err.message);
          process.exit();
        }
      });

      if (config.telemetry.enabled) {
        try {
          reporter.report(TelemetryReporter(
            config.telemetry.service,
            keypair
          ), config, farmer);
        } catch (err) {
          farmerconf.logger.error(
            'telemetry reporter failed, reason: %s', err.message
          );
        }
      }
    }

    var password = env.password || process.env.STORJSHARE_PASSPHRASE;

    if (password) {
      open(password, privkey);
    } else {
      prompt.start();
      prompt.get(UnlockSchema(program), function(err, result) {
        if (err) {
          return log('error', err.message);
        }

        open(result.password, privkey);
      });
    }
  },
  setup: function setup(env) {
    if (typeof env === 'string') {
      return log('error', 'Invalid argument supplied: %s', [env]);
    }

    if (!fs.existsSync(env.datadir)) {
      prompt.start();
      prompt.get(WizardSchema(env), function(err, result) {
        if (err) {
          return log('error', err.message);
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
            seeds: result.seed ? [result.seed] : [],
            opcodes: ['0f01020202', '0f02020202', '0f03020202'],
            forward: result.forward,
            tunnels: result.tunnels,
            tunnelport: result.tunnelport,
            gateways: { min: result.gatewaysmin, max: result.gatewaysmax }
          },
          telemetry: {
            service: 'https://status.storj.io',
            enabled: result.telemetry
          },
          loglevel: result.loglevel
        };

        fs.writeFileSync(
          path.join(result.datadir, CONFNAME),
          JSON.stringify(config, null, 2)
        );

        fs.writeFileSync(
          config.keypath,
          storj.utils.simpleEncrypt(result.password, storj.KeyPair().getPrivateKey())
        );

        log(
          'info',
          'Setup complete! Start farming with: storjshare start --datadir %s',
          [result.datadir]
        );
      });
    } else {
      log('error', 'Directory %s already exists', [env.datadir]);
    }
  },
  fallthrough: function fallthrough(command) {
    log(
      'error',
      'Unknown command "%s", please use --help for assistance',
      command
    );
    program.help();
  }
};

program
  .command('start')
  .description('begins farming data using the provided datadir')
  .option(
    '-d, --datadir <path>',
    'Set configuration and storage path',
    path.join(HOME, '.storjshare')
  )
  .option(
    '-p, --password [password]',
    'Password to unlock your private key',
    ''
  )
  .action(ACTIONS.start);

program
  .command('setup')
  .description('launches interactive configuration wizard')
  .option(
    '-d, --datadir [path]',
    'Set configuration and storage path',
    path.join(HOME, '.storjshare')
  )
  .action(ACTIONS.setup);

program
  .command('*')
  .description('prints the usage information to the console')
  .action(ACTIONS.fallthrough);

program.parse(process.argv);

if (process.argv.length < 3) {
  return program.help();
}
