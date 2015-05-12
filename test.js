var hvcp = require('./hvcp');
var async = require('async');

var device = new hvcp();

var args = process.argv.slice(2);

async.series([
  device.connect.bind(device, args[0]),
  device.getVersion.bind(device),
  device.setCameraOrientation.bind(device, 0),
  device.detect.bind(device, {"enableImageSmall": true}),
  // device.registerFace.bind(device, 0, 0)
], function(err, results) {
  console.warn(err);
  console.log(results);
});
