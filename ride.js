const express = require("express");
const Ride = require("../models/Ride");
const router = express.Router();

// Create Ride (Driver)
router.post("/create", async (req, res) => {
  try {
    const { driverId, from, to } = req.body;
    const ride = new Ride({ driverId, from, to });
    await ride.save();
    res.json(ride);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// Get all rides (Passenger searching)
router.get("/", async (req, res) => {
  try {
    const rides = await Ride.find().populate("driverId", "email");
    res.json(rides);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

module.exports = router;
