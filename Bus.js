const mongoose = require("mongoose");

const busSchema = new mongoose.Schema({
  busNumber: { type: String, unique: true },
  route: { type: mongoose.Schema.Types.ObjectId, ref: "Route" },
  currentStopIndex: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Bus", busSchema);
