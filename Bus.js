const mongoose = require("mongoose");

const busSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  busNumber: { type: String, required: true },
  route: { type: String, required: true },
  stops: [{ type: String }], // list of stops
  location: {
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
  }
});

module.exports = mongoose.model("Bus", busSchema);
