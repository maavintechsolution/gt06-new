const mongoose = require('mongoose');
require('dotenv').config();
const net = require('net');
const Location = require('./models/Location');

const PORT = process.env.PORT || 5023;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gt06';

// Mongoose setup
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB with Mongoose'))
  .catch(err => console.error('MongoDB connection error:', err));

// Convert a BCD buffer to integer
function bcdToInt(bcd) {
  let result = 0;
  for (let i = 0; i < bcd.length; i++) {
    result = result * 100 + ((bcd[i] >> 4) * 10) + (bcd[i] & 0x0f);
  }
  return result;
}

// GT06 packet parsing (placeholder, extend for all types)
function parseGT06Packet(buffer) {
  const imei = buffer.slice(4, 12).toString('hex');
  const protocolNumber = buffer[3];
  let location = null;
  // Accept both 0x12 and 0x22 as GPS/location packets
  if (protocolNumber === 0x12) {
    // For 0x12, the structure is as follows:
    // Date/time: 6 bytes (YY MM DD HH mm ss)
    const year = 2000 + buffer[12];
    const month = buffer[13];
    const day = buffer[14];
    const hour = buffer[15];
    const minute = buffer[16];
    const second = buffer[17];
    const timestamp = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    // Latitude: 4 bytes, Longitude: 4 bytes
    const latRaw = buffer.readUInt32BE(18);
    const lngRaw = buffer.readUInt32BE(22);
    const latitude = latRaw / 1800000;
    const longitude = lngRaw / 1800000;
    // Speed: 1 byte (for 0x12, usually at 26)
    const speed = buffer[26];
    location = { latitude, longitude, speed, timestamp };
  } else if (protocolNumber === 0x22) {
    // For protocol 0x22, GT06 extended GPS info
  // Date/time: 6 bytes (YY MM DD HH mm ss) at index 4-9
  const year = 2000 + buffer[4];
  const month = buffer[5];
  const day = buffer[6];
  const hour = buffer[7];
  const minute = buffer[8];
  const second = buffer[9];
  const datetime = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  // Satellites: buffer[10] (high nibble = GPS, low nibble = GSM)
  const satellites = buffer[10] & 0x0F;
  // Latitude (4 bytes, 11-14), Longitude (4 bytes, 15-18)
  const latRaw = buffer.readUInt32BE(11);
  const lngRaw = buffer.readUInt32BE(15);
  const latitude = latRaw / 1800000;
  const longitude = lngRaw / 1800000;
  // Speed (1 byte, 19)
  const speed = buffer[19];
  // Course & status (2 bytes, 20-21)
  const courseStatus = buffer.readUInt16BE(20);
  return { datetime, satellites, latitude, longitude, speed, courseStatus };
  }
  return {
    imei,
    protocolNumber,
    location,
    raw: buffer.toString('hex'),
  };
}

// Human-readable conversion (placeholder)
function toHumanReadable(packet) {
  const base = {
    imei: packet.imei,
    raw: packet.raw,
  };
  if ((packet.protocolNumber === 0x12 || packet.protocolNumber === 0x22) && packet.location) {
    return {
      ...base,
      type: 'GPS',
      deviceType: 'GT06',
      latitude: packet.location.latitude,
      longitude: packet.location.longitude,
      speed: packet.location.speed,
      timestamp: packet.location.timestamp,
    };
  }
  return base;
}

// Protocol response (placeholder)
function getResponseForPacket(packet, buffer) {
  // Login packet: protocol number 0x01
  if (packet.protocolNumber === 0x01) {
    // Find serial number (2 bytes before CRC, CRC is 2 bytes before 0D0A)
    let serial;
    if (buffer.length >= 12) {
      // Standard GT06 login packet: serial is at length-6 and length-5
      serial = buffer.slice(buffer.length - 6, buffer.length - 4);
    } else {
      // Fallback: use 0x00 0x01
      serial = Buffer.from([0x00, 0x01]);
    }
    // Build response: 78 78 05 01 [serial] [crc] 0D 0A
    const response = Buffer.alloc(10);
    response.write('7878', 0, 'hex');
    response.writeUInt8(0x05, 2);
    response.writeUInt8(0x01, 3);
    serial.copy(response, 4);
    // Calculate CRC for 0x05 0x01 [serial]
    const crc = crc16(response.slice(2, 6));
    response.writeUInt16BE(crc, 6);
    response.write('0d0a', 8, 'hex');
    return response;
  }
  // ...existing code for other packets...
  return Buffer.from('787805010001D9DC0D0A', 'hex'); // fallback
}

// CRC-16-CCITT calculation for GT06
function crc16(buf) {
  let crc = 0xFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i] << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xFFFF;
    }
  }
  return crc;
}

const server = net.createServer(socket => {
  socket.on('data', async data => {
    const packet = parseGT06Packet(data);
    const human = toHumanReadable(packet);
    // Log the protocol number (packet type) in hex using console.table
    console.table([{ 'Packet Type': '0x' + packet.protocolNumber.toString(16) }]);
    if ((packet.protocolNumber === 0x12 || packet.protocolNumber === 0x22) && packet.location) {
      await Location.create({
        imei: packet.imei,
        latitude: packet.location.latitude,
        longitude: packet.location.longitude,
        speed: packet.location.speed,
        timestamp: packet.location.timestamp,
        raw: packet.raw,
        type: 'GPS',
        deviceType: 'GT06',
        protocol: '0x' + packet.protocolNumber.toString(16), // Save protocol as string
      });
    }
    const response = getResponseForPacket(packet, data);
    socket.write(response);
    console.log('Received and responded to packet from IMEI:', packet.imei);
  });
  socket.on('error', err => console.error('Socket error:', err));
});

server.listen(PORT, () => {
  console.log(`GT06 server listening on port ${PORT}`);
});
