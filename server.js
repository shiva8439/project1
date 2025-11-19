const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB Error:', err));

// Import Models
const User  = require('./User');     // direct root se
const Bus   = require('./Bus');      // agar Bus.js bana hai toh
const Stop  = require('./Stop');
const Route = require('./Route');// You'll create this

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Token required" });

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

// Haversine Distance Formula
const getDistance = (loc1, loc2) => {
  const R = 6371000;
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(loc2.lat - loc1.lat);
  const dLon = toRad(loc2.lng - loc1.lng);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // meters
};

// ==================== ROUTES ====================

app.get('/', (req, res) => {
  res.json({ message: "SwiftRide Bus Tracking API Live!" });
});

// Get All Routes
app.get('/api/routes', async (req, res) => {
  try {
    const routes = await Route.find().populate('stops');
    res.json(routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Stops
app.get('/api/stops', async (req, res) => {
  try {
    const stops = await Stop.find();
    res.json(stops);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Buses by Route
app.get('/api/routes/:routeId/buses', async (req, res) => {
  try {
    const buses = await Bus.find({ route: req.params.routeId, isActive: true });
    res.json(buses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Nearest Bus + ETA (Main Feature)
app.post('/api/nearest-bus', async (req, res) => {
  const { lat, lng, routeId } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: "Location required" });

  try {
    const passengerLoc = { lat: parseFloat(lat), lng: parseFloat(lng) };
    const route = await Route.findById(routeId).populate('stops');
    if (!route) return res.status(404).json({ error: "Route not found" });

    const buses = await Bus.find({ route: routeId, isActive: true });

    let nearest = null;
    let minDist = Infinity;
    let eta = null;

    for (let bus of buses) {
      const dist = getDistance(passengerLoc, bus.currentLocation);

      // Find nearest stop to passenger
      let nearestStop = null;
      let stopDist = Infinity;
      route.stops.forEach(stop => {
        const d = getDistance(passengerLoc, stop.location);
        if (d < stopDist) {
          stopDist = d;
          nearestStop = stop;
        }
      });

      if (stopDist > 2000) continue; // 2km se door hai stop

      const busToStopDist = getDistance(bus.currentLocation, nearestStop.location);
      const estimatedMins = Math.round((busToStopDist / 1000) / 30 * 60); // 30 km/h avg

      if (dist < minDist && estimatedMins < 60) { // within 1 hour
        minDist = dist;
        nearest = {
          busNumber: bus.busNumber,
          currentLocation: bus.currentLocation,
          distanceFromYou: Math.round(dist),
          etaToYourStop: estimatedMins,
          nextStop: nearestStop.name
        };
      }
    }

    if (!nearest) {
      return res.json({ message: "No bus coming soon", nearestBus: null });
    }

    res.json({ nearestBus: nearest });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Driver: Update Bus Location (Use this from Driver App)
app.put('/api/buses/:busNumber/location', authenticateToken, async (req, res) => {
  if (req.user.role !== 'driver') {
    return res.status(403).json({ error: "Only drivers allowed" });
  }

  const { lat, lng } = req.body;
  const { busNumber } = req.params;

  try {
    const bus = await Bus.findOneAndUpdate(
      { busNumber },
      { 
        currentLocation: { lat: parseFloat(lat), lng: parseFloat(lng) },
        lastUpdated: new Date()
      },
      { new: true }
    );

    if (!bus) return res.status(404).json({ error: "Bus not found" });

    res.json({ message: "Location updated", bus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login / Signup (unchanged rakh sakta hai)
app.post('/api/login', async (req, res) => {
  // ... tera existing login code
});

// Start Server
app.listen(PORT, () => {
  console.log(`Bus Tracking Server Running on Port ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});

