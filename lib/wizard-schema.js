'use strict';

var storj = require('storj-lib');
var logger = require('./logger');
var url = require('url');
var fs = require('fs');
var path = require('path');
var platform = require('os').platform();
var bitcore = storj.deps.bitcore;
var utils = require('./utils');

var HOME = platform !== 'win32' ? process.env.HOME : process.env.USERPROFILE;

module.exports = function(program) {
  return {
    properties: {
      address: {
        description: 'Enter your public hostname or IP address',
        required: true,
        default: storj.Network.DEFAULTS.rpcAddress
      },
      port: {
        description: 'Enter the TCP port number the service should use (0 for random)',
        required: false,
        type: 'number',
        default: storj.Network.DEFAULTS.rpcPort,
        conform: function(value) {
          return (value > -1) && (value <= 65535);
        }
      },
      forward: {
        description: 'Use NAT traversal strategies to become available on the network',
        required: true,
        type: 'boolean',
        default: !storj.Network.DEFAULTS.doNotTraverseNat
      },
      seed: {
        description: 'Enter the URI of a known seed (leave empty to use bridge for discovery)',
        required: false,
        default: '',
        message: 'Invalid seed URI supplied, make sure the nodeID is correct',
        conform: function(value) {
          if (!value) {
            return true;
          }

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
          if (utils.fileDoesExist(value)) {
            return false;
          }
          fs.mkdirSync(value);
          return true;
        }
      },
      loglevel: {
        description: 'Enter the verbosity level for the logs (0-4)',
        required: true,
        default: 3,
        type: 'number',
        message: 'Invalid level supplied, must be 0 - 4',
        conform: function(value) {
          return value <= 4 && value >= 0;
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
      concurrency: {
        description: 'Enter the number of concurrent contracts to handle',
        required: true,
        default: 3,
        type: 'number',
        conform: function(value) {
          if (value !== 3) {
            logger('warn', 'Modifying this value can cause issues with getting contracts!');
            logger('warn', 'See: http://docs.storj.io/docs/storjshare-troubleshooting-guide#rpc-call-timed-out');
          }

          return true;
        }
      },
      payto: {
        description: 'Enter a payment address to receive rewards',
        required: true,
        conform: function(address) {
          return bitcore.Address.isValid(address) ||
                 bitcore.Address.isValid(address, bitcore.Networks.testnet);
        }
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
        default: storj.Network.DEFAULTS.maxTunnels,
        conform: function(value) {
          return (value > -1);
        }
      },
      tunnelport: {
        description: 'Enter the TCP port number the tunnel server should use (0 for random)',
        required: true,
        type: 'number',
        default: storj.Network.DEFAULTS.tunnelServerPort,
        conform: function(value) {
          return (value > -1) && (value <= 65535);
        }
      },
      gatewaysmin: {
        description: 'Enter the start TCP port for tunnel connections (0 for random)',
        required: true,
        type: 'number',
        default: storj.Network.DEFAULTS.tunnelGatewayRange.min,
        conform: function(value) {
          return (value > -1) && (value <= 65535);
        }
      },
      gatewaysmax: {
        description: 'Enter the end TCP port for tunnel connections (0 for random)',
        required: true,
        type: 'number',
        default: storj.Network.DEFAULTS.tunnelGatewayRange.max,
        conform: function(value) {
          return (value > -1) && (value <= 65535);
        }
      },
      keypath: {
        description: 'Enter the path to store your encrypted private key',
        required: true,
        default: path.join(program.datadir || path.join(HOME, '.storjshare'), 'id_ecdsa'),
        message: 'Refusing to overwrite the supplied path',
        conform: function(value) {
          if (utils.fileDoesExist(path.dirname(value))) {
            return !utils.fileDoesExist(value);
          } else {
            fs.mkdirSync(path.dirname(value));
            return true;
          }
        }
      },
      password: {
        description: 'Enter a password to protect your private key',
        hidden: true,
        replace: '*',
        required: true,
        default: program.password
      }
    }
  };
};
