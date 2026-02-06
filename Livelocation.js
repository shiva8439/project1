// models/LiveLocation.js
const mongoose = require("mongoose");

const LiveLocationSchema = new mongoose.Schema({
  busId: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", required: true },
  busNumber: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  bearing: { type: Number, default: 0 }
}, { timestamps: true });

LiveLocationSchema.index({ busId: 1, updatedAt: -1 });

module.exports = mongoose.model("LiveLocation", LiveLocationSchema);
