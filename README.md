Storj Share CLI
===============

A command line program for farming data on the Storj network.

Prerequisites
-------------

* Node.js v4.x.x
* Git
* Python v2.x.x

### Installing on GNU/Linux & Mac OSX

Install Node.js and it's package manager NPM using Node Version Manager:

```
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.31.1/install.sh | bash
```

> Detailed NVM installation instructions can be found [here](https://github.com/creationix/nvm#install-script).

After NVM is install, source your `~/.bashrc`, `~/.profile`, or `~/.zshrc`
depending on your shell of choice:

```
source ~/.zshrc
```

Now that you can call the `nvm` program, install Node.js (which comes with NPM):

```
nvm install 4.4.4
```

> You'll also need to make sure you have a C++ compiler installed before
> proceeding to the next step. Debian based distributions can install the
> `build-essential` package using APT and Mac OSX users can install with
> `xcode-select --install` and follow the wizard.

### Installing on Windows

Automated Script
 1. Download Latest Release of storj-automation (<a href="https://github.com/Storj/storj-automation/archive/master.zip">https://github.com/Storj/storj-automation/archive/master.zip</a>) 
 2. Extract ZIP, and navigate to `storj-automation-master\windows\storjshare-cli-automate`
 3. Double-click `install.bat`
 4. (if prompted) Click Yes on the User Account Control (UAC) screen 
 5. (if applicable) Reboot when completed
 6. Double-click `install.bat`
 7. Installation should be completed. Follow <a href="https://github.com/Storj/storjshare-cli#usage">https://github.com/Storj/storjshare-cli#usage</a> to complete.

#### Manual

Download [Node.js LTS](https://nodejs.org/en/download/) for Windows, launch the
installer and follow the setup instructions. Restart your PC, then test it from
the command prompt:

```
node --version
npm --version
```

Install the [latest version of Python 2.7](https://www.python.org/ftp/python/2.7.11/python-2.7.11.amd64.msi),
launch the installer and follow the instructions. To use Python from the shell
and add it to the system you have to add the path in "System Variables":

Navigate to:

```
Control Panel > System > Advanced System Settings > Environment Variables > System Variables > Path > Edit
```

Then add `;C:\Python27` or the installation path and test it in the command
prompt by running:

```
python -V
```

Next, install [Git](https://git-for-windows.github.io/) for your Windows
version. Then, install [Visual Studio Community 2015](https://www.visualstudio.com/)
and during the setup choose `Custom Installation > Programming Languages` and
select **Visual C++** and **Common Tools for Visual C++**.

Finally, set the new environment variable in the Windows command prompt with:

````
setx GYP_MSVS_VERSION 2015
```

Installation
------------

After installing the prerequisites you should have access to the `node` and
`npm` programs. Use `npm` to install StorjShare CLI *globally* (this links the
executable to your PATH):

```
npm install -g storjshare-cli
```

Once the installation completes, you'll have access to the `storjshare` program.
You can later update the version with NPM:

```
npm update -g storjshare-cli
```

Once installed, you will have access to the `storjshare` command line interface.
To make sure everything installed correctly, run:

```
storjshare --help
```

> Note: You will need to configure an SJCX address (counterparty) to receive 
> funds. This can be set up through [CounterWallet (web)](https://counterwallet.io/) 
> or [IndieSquare (mobile app)](https://wallet.indiesquare.me/).

Setup
------------

Before you can start farming, you'll need to run the setup wizard. It will walk
you through generating a configuration file and an ECDSA private key which will
be encrypted with a passphrase of your choice.

```
storjshare setup

 Let's setup your Storj configuration!

 [...] > Enter your public hostname or IP address >  (127.0.0.1)
 [...] > Enter the TCP port number the service should use (0 for random) >  (0)
 [...] > Use NAT traversal strategies to become available on the network >  (true)
 [...] > Enter the URI of a known seed >>  (storj://api.storj.io:8443/78cfca0e01235db817728aec056d007672ffac63)
 [...] > Enter the path to store configuration and data >  (/home/gordon/.storjshare)
 [...] > Enter the amount of storage space you can share >  (5MB)
 [...] > Enter a payment address to receive rewards (telemetry must be enabled) >  19yTbd85U2QrnUvburphe1kHxKBgR92WYj
 [...] > Will you share telemetry data with Storj to help improve the network? >  (false) true
 [...] > Enter the number of tunnel connection other farmer can open through you >  (3)
 [...] > Enter the TCP port number the tunnel server should use (0 for random) >  (0)
 [...] > Enter the start TCP port for tunnel connections (0 for random) >  (0)
 [...] > Enter the end TCP port for tunnel connections (0 for random) >  (0)
 [...] > Enter the path to store your encrypted private key >  (/home/gordon/.storjshare/id_ecdsa)
 [...] > Enter a password to protect your private key >  ********
```
The setup wizard should now be completed.

Usage
------------

Now that the setup wizard has completed, you can begin farming by running:

```
storjshare start
```

You can run multiple instances by specifying a different data directory using
the `--datadir` option.

```
storjshare setup --datadir /path/to/custom/datadir
...
storjshare start --datadir /path/to/custom/datadir
```

You can also have the private key's password retrieved from the environment
variable `STORJSHARE_PASSPHRASE`

```
> STORJSHARE_PASSPHRASE=sup3rS3crEt storjshare start
```

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
pm2 start path/to/storjshare-cli/bin/storjshare.js -- start --password <your_password>
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
