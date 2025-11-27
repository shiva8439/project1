// models/LiveLocation.js
const mongoose = require("mongoose");

const LiveLocationSchema = new mongoose.Schema({
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true }, // Vehicle ke ObjectId
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  bearing: { type: Number, default: 0 } // optional, direction of vehicle
}, { timestamps: true }); // createdAt & updatedAt automatically

// Index for faster queries by vehicle and most recent locations
LiveLocationSchema.index({ vehicle: 1, createdAt: -1 });

module.exports = mongoose.model("LiveLocation", LiveLocationSchema);
