var hvcp = require('./hvcp');
var async = require('async');

var device = new hvcp();

var args = process.argv.slice(2);

async.series([
  device.connect.bind(device, args[0], {
    baudrate: 460800
  }),
  device.getVersion.bind(device),
  device.setCameraOrientation.bind(device, 0),
  // device.detect.bind(device, {"enableImageSmall": true}),
  // device.detect.bind(device),
  // device.registerFace.bind(device, 0, 0),
  device.checkRegisteredData.bind(device, 2),
  // device.deleteAllFaces.bind(device),
  function(callback) {
    device.readAlbum(function(err, result) {
      console.log(result);
      // device.loadAlbum(result.data.album, result.data.crc, callback);
    });
  },
], function(err, results) {
  console.warn(err);
  console.log(results);
});
