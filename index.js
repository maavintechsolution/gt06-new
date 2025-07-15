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
  // GT06 protocol: GPS data packet type is 0x12
  const imei = buffer.slice(4, 12).toString('hex');
  const protocolNumber = buffer[3];
  let location = null;
  if (protocolNumber === 0x12) {
    // GPS info starts at byte 13 (index 12)
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
    // Speed: 1 byte
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
  if (packet.protocolNumber === 0x12 && packet.location) {
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
function getResponseForPacket(packet) {
  // TODO: Implement correct response per GT06 protocol
  return Buffer.from('787805010001D9DC0D0A', 'hex'); // Example: login response
}

const server = net.createServer(socket => {
  socket.on('data', async data => {
    const packet = parseGT06Packet(data);
    const human = toHumanReadable(packet);
    if (packet.protocolNumber === 0x12 && packet.location) {
      // Store only GPS packets with location info
      await Location.create({
        imei: packet.imei,
        latitude: packet.location.latitude,
        longitude: packet.location.longitude,
        speed: packet.location.speed,
        timestamp: packet.location.timestamp,
        raw: packet.raw,
        type: 'GPS'
      });
    }
    const response = getResponseForPacket(packet);
    socket.write(response);
    console.log('Received and responded to packet from IMEI:', packet.imei);
  });
  socket.on('error', err => console.error('Socket error:', err));
});

server.listen(PORT, () => {
  console.log(`GT06 server listening on port ${PORT}`);
});
