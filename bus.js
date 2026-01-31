const express = require("express");
const router = express.Router();
const Bus = require("../routes/bus");
const authenticateToken = require("../middleware/auth");

/**
 * ADD BUS (driver only)
 */
router.post("/add", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ error: "Only drivers allowed" });
    }

    const { busNumber, route, stops } = req.body;
    if (!busNumber || !route) {
      return res.status(400).json({ error: "busNumber & route required" });
    }

    const exists = await Bus.findOne({ busNumber });
    if (exists) {
      return res.status(400).json({ error: "Bus already exists" });
    }

    const bus = await Bus.create({
      driverId: req.user.userId,
      busNumber,
      route,
      stops: stops || []
    });

    res.status(201).json({ success: true, bus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET ALL BUSES
 */
router.get("/all", async (req, res) => {
  try {
    const buses = await Bus.find();
    res.json({ success: true, buses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🔥 UPDATE LOCATION BY BUS NUMBER (MAIN FIX)
 */
router.put("/:busNumber/location", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ error: "Only drivers allowed" });
    }

    const { latitude, longitude } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: "latitude & longitude required" });
    }

    const bus = await Bus.findOne({ busNumber: req.params.busNumber });
    if (!bus) {
      return res.status(404).json({ error: "Bus not found" });
    }

    bus.location.latitude = latitude;
    bus.location.longitude = longitude;
    bus.location.updatedAt = new Date();
    await bus.save();

    res.json({
      success: true,
      message: "Location updated",
      busNumber: bus.busNumber,
      location: bus.location
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
