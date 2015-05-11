var SerialPort = require("serialport").SerialPort
var serialPort = new SerialPort("/dev/tty.usbserial-A603A1OQ", {
  baudrate: 921600
});
serialPort.on("open", function () {
  console.log('open');
  serialPort.on('data', function(data) {
    console.log('data received: ' + data.length + ' bytes');
    console.log(data.toString('hex'));
  });
  serialPort.write(new Buffer('fe000000', 'hex'), function(err, results) {
    console.log('err ' + err);
    console.log('results ' + results);
  });
  // serialPort.write(new Buffer('FE', 'hex'));
  // serialPort.write(new Buffer('00', 'hex'));
  // serialPort.write(new Buffer('00', 'hex'));
  // serialPort.write(new Buffer('00', 'hex'));
  // serialPort.write(new Buffer('FE000000', 'hex'), function(err, results) {
  //   console.log('err ' + err);
  //   console.log('results ' + results);
  // });

});

