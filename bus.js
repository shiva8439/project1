const express = require("express");
const router = express.Router();
const Bus = require("../modules/Bus"); // Bus model import
const jwt = require("jsonwebtoken");

// JWT Middleware (agar server.js me authenticateToken nahi export kiya to yeh copy kar lo)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ status: 'error', message: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ status: 'error', message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Add new bus
router.post("/add", authenticateToken, async (req, res) => {
  try {
    const { busNumber, route, stops } = req.body;
    const driverId = req.user.userId;

    if (!busNumber || !route) {
      return res.status(400).json({ status: "error", message: "Bus number and route are required" });
    }

    const newBus = new Bus({ driverId, busNumber, route, stops });
    await newBus.save();

    res.status(201).json({ status: "success", bus: newBus });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Get all buses
router.get("/list", async (req, res) => {
  try {
    const buses = await Bus.find().populate("driverId", "email");
    res.json({ status: "success", buses });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports = router;
