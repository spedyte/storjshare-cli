Storj Share CLI
===============

A command line program for farming data on the Storj network.

Installation
------------

Install *globally* with NPM:

```
[sudo] npm install -g storjshare-cli
```

Update old version *globally* with NPM:

```
[sudo] npm update -g storjshare-cli
```

Once installed, you will have access to the `storjshare` command line interface. To
make sure everything installed correctly, run:

```
storjshare --help
```

The first time you run the `storj` program, it will walk you through a setup
wizard to generate a configuration file and an ECDSA private key which will be
encrypted with a pass phrase of your choice.

```
> $ storjshare

 Let's setup your Storj configuration!

 STORJSHARE >> Enter your public hostname or IP address >>  (127.0.0.1)
 STORJSHARE >> Enter the TCP port number the service should use (0 for random) >>  (0)
 STORJSHARE >> Use NAT traversal strategies to become available on the network >>  (true)
 STORJSHARE >> Enter the URI of a known seed >>  (storj://api.metadisk.org:8443/78cfca0e01235db817728aec056d007672ffac63)
 STORJSHARE >> Enter the path to store configuration and data >>  (/home/gordon/.storjshare)
 STORJSHARE >> Enter the amount of storage space you can share >>  (5MB)
 STORJSHARE >> Enter a payment address to receive rewards (telemetry must be enabled) >>  19yTbd85U2QrnUvburphe1kHxKBgR92WYj
 STORJSHARE >> Will you share telemetry data with Storj to help improve the network? >>  (false) true
 STORJSHARE >> Enter the number of tunnel connection other farmer can open through you >>  (3)
 STORJSHARE >> Enter the TCP port number the tunnel server should use (0 for random) >>  (0)
 STORJSHARE >> Enter the start TCP port for tunnel connections (0 for random) >>  (0)
 STORJSHARE >> Enter the end TCP port for tunnel connections (0 for random) >>  (0)
 STORJSHARE >> Enter the path to store your encrypted private key >>  (/home/gordon/.storjshare/id_ecdsa)
 STORJSHARE >> Enter a password to protect your private key >>  ********
```

Once the setup wizard has completed, you will be asked to decrypt your key and
the program will connect to the network.

You can run multiple instances by specifying a different data directory using
the `--datadir` option. If no configuration has been created for the given
data directory, then the setup wizard will run again.

Running in the Background
-------------------------

You can run a farmer in the background using a process manager like
[PM2](https://github.com/Unitech/pm2):

```
npm install -g pm2
```

Now you can instruct PM2 to start your farmer in the background and keep it
running, restarting it automatically in the event that it goes down.

```
pm2 start path/to/storjshare-cli/bin/farmer.js -- --password <your_password>
```

Check the logs at any time with:

```
pm2 logs 0
```

Configuring Contract Subscriptions
----------------------------------

By default, if you indicated during the wizard that you'd like to accept
storage contracts from the network, `storj` will set a few common contract
opcode sequences in your configuration file:

```
{
  ...
  "network": {
    "opcodes": [
      "0f01020202",
      "0f02020202",
      "0f03020202"
    ]
  }
  ...
}
```

These opcodes indicate you are interested in storing shards between 0mb-32mb
for up to 90 days at a time and that your availability and speed is average. You
might like to tweak these settings to better suit your hardware.

See [Contract Topics](http://storj.github.io/core/tutorial-contract-topics.html)
for more information on which opcodes you should use.


Configuration
-------------

For complete documentation on the format of the configuration file, see
[Abstract Interfaces](http://storj.github.io/core/tutorial-abstract-interfaces.html).

License
-------

```
StorjShare CLI - A command line program for farming data on the Storj network.
Copyright (C) 2016  Storj Labs, Inc

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
```
