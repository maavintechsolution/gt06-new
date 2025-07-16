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

// GT06 packet parsing (placeholder, extend for all types)
function parseGT06Packet(buffer) {
  const imei = buffer.slice(4, 12).toString('hex');
  const protocolNumber = buffer[3];
  let location = null;
  // Accept both 0x12 and 0x22 as GPS/location packets
  if (protocolNumber === 0x12 || protocolNumber === 0x22) {
    // For 0x22, the structure is similar to 0x12 for most GT06 devices
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
    // Speed: 1 byte (for 0x22, usually at 26)
    const speed = buffer[26];
    location = { latitude, longitude, speed, timestamp };
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
    // Response: 78780501[serial][crc][0d0a]
    // Serial number is at the end of the login packet (2 bytes before CRC)
    // For GT06, serial is usually at buffer.length - 6 and -5
    const serial = buffer.slice(buffer.length - 6, buffer.length - 4);
    // Calculate CRC (here, just echoing back as per protocol for login)
    // Response: 78 78 05 01 [serial] [crc] 0D 0A
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
