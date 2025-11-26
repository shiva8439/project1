const mongoose = require("mongoose");

const LiveLocationSchema = new mongoose.Schema({
  busId: { type: String, required: true },
  lat: Number,
  lng: Number,
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("LiveLocation", LiveLocationSchema);
