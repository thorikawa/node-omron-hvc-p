#!/usr/bin/nodejs
//
// sample program for OMRON HVC-P
//
// HVC-C1B serial protocol
//   http://plus-sensing.omron.co.jp/product/files/HVC-C1B_%E3%82%B3%E3%83%9E%E3%83%B3%E3%83%88%E3%82%99%E4%BB%95%E6%A7%98%E6%9B%B8_A.pdf
//

var HvcP = function() {
	this.buffer = new Buffer(0);
	this.onResponse = null;
};

HvcP.prototype.connect = function(path, options, callback) {
	var args = Array.prototype.slice.call(arguments);
	callback = args.pop();
	if (typeof (callback) !== 'function') callback = null;

	options = options || {};
	var baudrate = options.baudrate || 921600;

	var SerialPort = require('serialport').SerialPort
	this.conn = new SerialPort(path, {
	  "baudrate": baudrate
	});
	this.conn.on('open', function() {
	  console.log('opened');
	  this.conn.on('disconnect', function(err) {
	  	console.log('disconnect...');
	  });
	  this.conn.on('error', function(err) {
	  	console.log('err...');
	  });
	  this.conn.on('data', this.onData.bind(this));
	  callback && callback(null);
	  // setTimeout(this.start.bind(this), 1000);
	}.bind(this));
}

HvcP.prototype.clearBuffer = function() {
	this.buffer = new Buffer(0);
}

HvcP.prototype.onData = function(data) {
	this.buffer = Buffer.concat([this.buffer, data])

	// check response header
	if (this.buffer[0] != 0xfe) {
		console.log("invalid response data...");
		this.clearBuffer();
		return;
	}

	// check payload length
	if (this.buffer.length < 6) {
		return;
	}
	var data_len = this.buffer.readUInt32LE(2);
	var response_len = 1 + 1 + 4 + data_len;
	if (this.buffer.length < response_len) {
		return;
	} else if (this.buffer.length > response_len) {
		console.log("invalid response data...");
		this.clearBuffer();
		return;
	}

	var responseCode = this.buffer.readUInt8(1);

	if (this.onResponse) {
		this.onResponse(responseCode, this.buffer.slice(6, this.buffer.length));
	}
	this.clearBuffer();
}

HvcP.prototype.sendCommand = function(buf) {
	this.clearBuffer();
	// console.log('send_cmd() : buf=' + buf.toString('hex'));
	this.conn.write(buf)
}

HvcP.prototype.getVersion = function(callback) {
	this.onResponse = function(responseCode, data) {
		var model          = data.slice(0, 12).toString();
		var majorVersion   = data.slice(12, 13).readUInt8(0);
		var minorVersion   = data.slice(13, 14).readUInt8(0);
		var releaseVersion = data.slice(15, 16).readUInt8(0);
		var revision       = data.slice(16, 20).toString('hex')

		if (callback) {
			callback(null, {
				"responseCode" : responseCode,
				"data" : {
					"model": model,
					"majorVersion": majorVersion,
					"minorVersion": minorVersion,
					"releaseVersion": releaseVersion,
					"revision": revision
				}
			});
		}
	};

	this.sendCommand(new Buffer('fe000000', 'hex'));
}

HvcP.prototype.setCameraOrientation = function(angle, callback) {
	this.onResponse = function(responseCode, data) {
		if (callback) {
			callback(null, {
				"responseCode": responseCode
			});
		}
	};

	var n = 0;
	if (angle == 0) {
		n = 0
	} else if (angle == 90) {
		n = 1;
	} else if (angle == 180) {
		n = 2;
	} else if (angle == 270) {
		n = 3;
	}

	var buf = new Buffer(5);
	buf[0] = 0xfe;
	buf[1] = 0x01;
	buf.writeUInt16LE(1, 2); // data length
	buf.writeUInt8(n, 4); // orientation (0-3)

	this.sendCommand(buf);
}

HvcP.prototype.parseBodyData = function(size, data) {
	var result = [];

	for (var i = 0; i < size; ++i) {
		var d = data.slice(i * 8, i * 8 + 8);
		var r = {};
		r.x          = d.readUInt16LE(0);
		r.y          = d.readUInt16LE(2);
		r.size       = d.readUInt16LE(4);
		r.confidence = d.readUInt16LE(6);

		result.push(r);
	}
	return result;
}

HvcP.prototype.parseHandData = function(size, data) {
	var result = [];

	for (var i = 0; i < size; ++i) {
		var d = data.slice(i * 8, i * 8 + 8);
		var r = {};
		r.x          = d.readUInt16LE(0);
		r.y          = d.readUInt16LE(2);
		r.size       = d.readUInt16LE(4);
		r.confidence = d.readUInt16LE(6);

		result.push(r);
	}
	return result;
}

HvcP.prototype.parseFaceData = function(size, data) {
	var result = [];

	for (var i = 0; i < size; ++i) {
		var d = data.slice(i * 38, i * 38 + 38);

		var r = {};
		r.x              = d.readInt16LE(0); 
		r.y              = d.readInt16LE(2);
		r.size           = d.readInt16LE(4);
		r.confidence     = d.readUInt16LE(6); 

		r.dir = {};
		r.dir.yaw        = d.readInt16LE(8);
		r.dir.pitch      = d.readInt16LE(10);
		r.dir.roll       = d.readInt16LE(12);
		r.dir.confidence = d.readUInt16LE(14);

		r.age = {};
		r.age.age        = d.readInt8(16);
		r.age.confidence = d.readUInt16LE(17);

		r.gen = {};
		var gen = d.readInt8(19);
		switch(gen) {
		case 0:
			r.gen.gender = 'female';
			break;
		case 1:
			r.gen.gender = 'male';
			break;
		default:
			r.gen.gender = 'unknown';
		}
		r.gen.confidence = d.readUInt16LE(20);

		r.gaze = {};
		r.gaze.gazeLR    = d.readInt8(22);
		r.gaze.gazeUD    = d.readInt8(23);

		r.blink = {};
		r.blink.ratioL   = d.readInt16LE(24);
		r.blink.ratioR   = d.readInt16LE(26);

		r.exp = {};
		r.exp.neutralness = d.readInt8(28);
		r.exp.happiness = d.readInt8(29);
		r.exp.surpriseness = d.readInt8(30);
		r.exp.angriness = d.readInt8(31);
		r.exp.sadness = d.readInt8(32);
		r.exp.negaposi = d.readInt8(33);

		r.user = {};
		r.user.id = d.readInt16LE(34);
		r.user.score = d.readInt16LE(36);

		console.log(r);
	
		result.push(r);
	}

	return result;
}

HvcP.prototype.parseImage = function(data) {
	var r = {};
	r.width = data.readUInt16LE(0);
	r.height = data.readUInt16LE(2);
	r.data = data.slice(4, data.length);
	return r;
}

HvcP.prototype.parseExecuteResult = function(data, options) {
	// header
	var bodyNum = data.readUInt8(0);
	var handNum = data.readUInt8(1);
	var faceNum = data.readUInt8(2);

	var idx = 4;
	bodyData = data.slice(idx, idx + 8 * bodyNum);

	idx += bodyData.length
	handData = data.slice(idx, idx + 8 * handNum);

	idx += handData.length
	faceData = data.slice(idx, idx + 38 * faceNum);

	idx += faceData.length;

	result = {};
	result.body = this.parseBodyData(bodyNum, bodyData, options);
	result.hand = this.parseHandData(handNum, handData, options);
	result.face = this.parseFaceData(faceNum, faceData, options);
	if (options.enableImage) {
		imageData = data.slice(idx, idx + 76804);
		result.image = this.parseImage(imageData, options);
	} else if (options.enableImageSmall) {
		imageData = data.slice(idx, idx + 19204);
		result.image = this.parseImage(imageData, options);
	}

	return result;
}

HvcP.prototype.parseFaceRegisterData = function(data, options) {
	var r = {};
	r.width = data.readUInt16LE(0);
	r.height = data.readUInt16LE(2);
	r.data = data.slice(4);
	return r;
}

HvcP.prototype.parseReadAlbumResult = function(data) {
	var r = {};
	r.size = data.readUInt32LE(0);
	r.crc = data.readUInt32LE(4);
	r.album = data.slice(8);
	return r;
}

HvcP.prototype.parseRegisteredData = function(data) {
	var r = {};
	var flag = data.readUInt16LE(0);
	r.flag = [];
	for (var i=0; i<10; ++i) {
		r.flag.push((flag & (1 << i)) > 0);
	}
	console.log(r.flag);
	return r;
}

HvcP.prototype.detect = function(options, callback) {
	var args = Array.prototype.slice.call(arguments);
	callback = args.pop();
	if (typeof (callback) !== 'function') callback = null;
	options = options || {};

	this.onResponse = function(responseCode, data) {
		console.log("detect: responseCode = " + responseCode);
		result = this.parseExecuteResult(data, options);
		if (callback) {
			callback(null, {
				"responseCode": responseCode,
				"data": result
			});
		}
	};

	var buf = new Buffer(7);
	buf[0] = 0xfe;
	buf[1] = 0x04;
	buf.writeUInt16LE(3, 2); // data length
	buf.writeUInt8(0xfc, 4); // (disable body & hands detection...)
	buf.writeUInt8(0x03, 5); // enable face recognition
	var imageBit = 0x00;
	if (options.enableImage) {
		imageBit = 0x01;
	} else if (options.enableImageSmall) {
		imageBit = 0x02;
	}
	buf.writeUInt8(imageBit, 6);

	this.sendCommand(buf);
}

HvcP.prototype.registerFace = function(userId, dataId, callback) {
	this.onResponse = function(responseCode, data) {
		console.log("face_register: responseCode = " + responseCode);
		if (responseCode == 1) {
			callback("Error: detected no face to register.");
			return;
		} else if (responseCode == 2) {
			callback("Error: detected more than one face to register.");
			return;
		}
		result = this.parseFaceRegisterData(data);
		if (callback) {
			callback(null, {
				"responseCode": responseCode,
				"data": result
			});
		}
	};

	var buf = new Buffer(7);
	buf[0] = 0xfe;
	buf[1] = 0x10;
	buf.writeUInt16LE(3, 2); // data length
	buf.writeUInt16LE(userId, 4);
	buf.writeUInt8(dataId, 6);

	this.sendCommand(buf);
}

HvcP.prototype.deleteAllFaces = function(callback) {
	this.onResponse = function(responseCode, data) {
		var error = null;
		console.log("delete_all_faces: responseCode = " + responseCode);
		if (responseCode != 0) {
			error = "Error: unknown error: " + responseCode;
		}
		if (callback) {
			callback(error, {
				"responseCode": responseCode
			});
		}
	};

	this.sendCommand(new Buffer('fe130000', 'hex'));
}

HvcP.prototype.checkRegisteredData = function(userId, callback) {
	this.onResponse = function(responseCode, data) {
		console.log("face_register: responseCode = " + responseCode);
		if (responseCode == 1) {
			callback("Error: detected no face to register.");
			return;
		} else if (responseCode == 2) {
			callback("Error: detected more than one face to register.");
			return;
		}
		result = this.parseRegisteredData(data);
		if (callback) {
			callback(null, {
				"responseCode": responseCode,
				"data": result
			});
		}
	};

	var buf = new Buffer(6);
	buf[0] = 0xfe;
	buf[1] = 0x15;
	buf.writeUInt16LE(2, 2);
	buf.writeUInt16LE(userId, 4);

	this.sendCommand(buf);
}

HvcP.prototype.saveFlashRom = function(callback) {
	this.onResponse = function(responseCode, data) {
		var error = null;
		console.log("save_flash_rom: responseCode = " + responseCode);
		if (responseCode != 0) {
			error = "Error: unknown error: " + responseCode;
		}
		if (callback) {
			callback(error, {
				"responseCode": responseCode
			});
		}
	};

	this.sendCommand(new Buffer('fe220000', 'hex'));
}

HvcP.prototype.readAlbum = function(callback) {
	this.onResponse = function(responseCode, data) {
		var error = null;
		var result = null;
		console.log("raed_album: responseCode = " + responseCode);
		if (responseCode != 0) {
			error = "Error: unknown error: " + responseCode;
		} else {
			result = this.parseReadAlbumResult(data);
		}
		if (callback) {
			callback(error, {
				"responseCode": responseCode,
				"data": result
			});
		}
	};

	this.sendCommand(new Buffer('fe200000', 'hex'));
}

HvcP.prototype.loadAlbum = function(albumData, crc, callback) {
	this.onResponse = function(responseCode, data) {
		var error = null;
		console.log("load_album: responseCode = " + responseCode);
		if (responseCode != 0) {
			error = "Error: unknown error: " + responseCode;
		}
		if (callback) {
			callback(error, {
				"responseCode": responseCode
			});
		}
	};

	var buf = new Buffer(16);
	buf[0] = 0xfe;
	buf[1] = 0x21;
	buf.writeUInt32LE(4, 2);
	buf.writeUInt32LE(albumData.length + 8, 4);
	buf.writeUInt32LE(albumData.length, 8);
	buf.writeUInt32LE(crc, 12);
	buf = Buffer.concat([buf, albumData])

	this.sendCommand(buf);
}

module.exports = HvcP;
