const mongoose = require("mongoose");

const busSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  busNumber: { type: mongoose.Schema.Types.ObjectId, ref: "busNumber", required: true },
  route: { type: mongoose.Schema.Types.ObjectId, ref: "Route", required: true },
  stops: [{ type: mongoose.Schema.Types.ObjectId, ref: "Stop" }],
  location: {
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
  },
  currentStopIndex: { type: Number, default: -1 }, // -1 means not started
  isActive: { type: Boolean, default: true },
  lastStopReached: { type: mongoose.Schema.Types.ObjectId, ref: "Stop" }
});

module.exports = mongoose.model("Bus", busSchema);
