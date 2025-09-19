const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  passengerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  from: String,
  to: String,
  status: { type: String, enum: ["pending", "active", "completed"], default: "pending" }
}, { timestamps: true });

module.exports = mongoose.model("Ride", rideSchema);
