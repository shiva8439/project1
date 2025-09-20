// routes/bus.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Bus = require("../models/Bus"); // schema yahan import hoga
const dotenv = require("dotenv");
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware for JWT authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ status:'error', message:'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ status:'error', message:'Invalid token' });
    req.user = user;
    next();
  });
};

// ---------------- Bus Routes ----------------

// Get all buses
router.get("/", async (req, res) => {
  try {
    const buses = await Bus.find().populate('driverId', 'email');
    res.json(buses.map(bus => ({
      id: bus._id,
      busNumber: bus.busNumber,
      route: bus.route,
      stops: bus.stops,
      driver: bus.driverId ? bus.driverId.email : "Unknown",
      location: bus.location
    })));
  } catch (err) {
    console.error("Get buses error:", err);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

// Add new bus (drivers only)
router.post("/", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "driver") 
      return res.status(403).json({ status:'error', message:'Only drivers can add buses' });

    const { busNumber, route, stops } = req.body;
    if (!busNumber || !route) 
      return res.status(400).json({ status:'error', message:'busNumber and route are required' });

    const existingBus = await Bus.findOne({ busNumber });
    if (existingBus) 
      return res.status(400).json({ status:'error', message:'Bus with this number already exists' });

    const newBus = new Bus({
      driverId: req.user.userId,
      busNumber,
      route,
      stops
    });

    await newBus.save();
    res.status(201).json({ status:'success', message:'Bus added successfully', bus: newBus });
  } catch (err) {
    console.error("Add bus error:", err);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

// Update bus location (drivers only)
router.put("/:id/location", authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const bus = await Bus.findOneAndUpdate(
      { _id: req.params.id, driverId: req.user.userId },
      { location: { latitude, longitude, updatedAt: new Date() } },
      { new: true }
    );

    if (!bus) return res.status(404).json({ status:'error', message:'Bus not found or not authorized' });

    res.json({ status:'success', message:'Location updated', bus });
  } catch (err) {
    console.error("Update bus location error:", err);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

module.exports = router;
