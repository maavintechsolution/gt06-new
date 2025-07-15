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
}, { timestamps: true });

module.exports = mongoose.model('Location', locationSchema);
