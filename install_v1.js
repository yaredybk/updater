const Service = require('node-windows').Service;
const fs = require('fs');
const os = require('os');
const path = require('path');
// load dotenv
// require('dotenv').config();
const execPath = path.resolve(os.homedir(), '.deno\\bin\\deno.exe');
console.log(`deno path: ${execPath}`);


// Fetch username and password from command-line arguments
const uname = process.argv[2];
const pass = process.argv[3];

// Check for missing arguments and raise an error
if (!uname || !pass) {
  throw new Error(
    'Error: Username and password must be provided as command-line arguments.\nUsage: node script.js <username> <password>'
  );
}

console.log(`-> user: ${uname}`);
console.log(`-> pass: ${pass.replaceAll(/./g, '*')}`);

/**
 * @type {"install" | "uninstall"}
 */
let ACTION = !process.argv[4]
  ? 'install'
  : process.argv[4]?.startsWith('u')
  ? 'uninstall'
  : 'install';

console.log(' --->>> ', ACTION);

const scriptPath ='.\\index.js';

function createService(svc) {
  svc.logOnAs.account = uname;
  svc.logOnAs.password = pass;

  function installService() {
    if (ACTION === 'uninstall') return console.warn('install skipped.');
    console.log('Installing service...');
    svc.install();
  }

  svc.on('uninstall', function () {
    console.log(
      'Service uninstalled successfully. Proceeding to installation...'
    );
    installService();
  });

  svc.on('install', function () {
    console.log('Service installed successfully.');
    svc.start();
  });

  svc.on('start', function () {
    console.log('Service started successfully.');
  });

  svc.on('error', function (err) {
    console.error(`Service error: ${err.message}`);
  });

  if (svc.exists) {
    console.log('Service already exists. Uninstalling first...');
    svc.uninstall();
  } else {
    console.log('Service does not exist. Proceeding with installation...');
    installService();
  }
}

// deno runtime
const svc2 = new Service({
  name: '_finix_updater',
  description: 'finix garage system updater',
  script: scriptPath,
  scriptOptions: '--allow-all --no-check --env-file',
  env: [
  ],
  maxRetries: 10,
  allowServiceLogon: true,
  execPath,
});

createService(svc2);
