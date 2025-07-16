const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  imei: { type: String, required: true, index: true },
  latitude: Number,
  longitude: Number,
  speed: Number,
  timestamp: Date,
  raw: String,
  type: String,
  deviceType: String,
  protocol: { type: String }, // Store protocol as string, e.g., '0x12' or '0x22'
}, { timestamps: true });

module.exports = mongoose.model('Location', locationSchema);
