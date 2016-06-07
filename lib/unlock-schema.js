'use strict';

module.exports = function(program) {
  return {
    properties: {
      password: {
        description: 'Unlock your private key to start storj',
        hidden: true,
        replace: '*',
        required: true
      }
    }
  };
};
