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
  .catch(err => {
    console.log('MongoDB Connection Failed:', err.message);
    process.exit(1); // agar DB na chale to server crash ho jaye
  });

// Import Models (root mein hi hain sab)
const User  = require('./User');
const Bus   = require('./Bus');
const Stop  = require('./Stop');
const Route = require('./Route');  // ← Ye file ab ban chuki hogi na?

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Token required" });

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-here', (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token" });
    req.user = user;
    next();
  });
};

// Haversine Distance (perfect hai)
const getDistance = (loc1, loc2) => {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(loc2.lat - loc1.lat);
  const dLon = toRad(loc2.lng - loc1.lng);
  const a = Math.sin(dLat/2)**2 + 
            Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) * 
            Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // meters
};

// ==================== ROUTES ====================

app.get('/', (req, res) => {
  res.json({ message: "SwiftRide Bus Tracking API Live!" });
});

// 1. Get All Routes
app.get('/api/routes', async (req, res) => {
  try {
    const routes = await Route.find().populate('stops');
    res.json({ success: true, data: routes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get All Stops
app.get('/api/stops', async (req, res) => {
  try {
    const stops = await Stop.find();
    res.json({ success: true, data: stops });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get Buses by Route
app.get('/api/routes/:routeId/buses', async (req, res) => {
  try {
    const buses = await Bus.find({ route: req.params.routeId, isActive: true });
    res.json({ success: true, data: buses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Nearest Bus + ETA (Sabse Important)
app.post('/api/nearest-bus', async (req, res) => {
  const { lat, lng, routeId } = req.body;
  if (!lat || !lng || !routeId) {
    return res.status(400).json({ error: "lat, lng, routeId required" });
  }

  try {
    const passengerLoc = { lat: parseFloat(lat), lng: parseFloat(lng) };
    const route = await Route.findById(routeId).populate('stops');
    if (!route) return res.status(404).json({ error: "Route not found" });

    const buses = await Bus.find({ route: routeId, isActive: true });
    if (buses.length === 0) return res.json({ message: "No bus on this route", nearestBus: null });

    let nearest = null;
    let minETA = Infinity;

    for (let bus of buses) {
      // Passenger ka nearest stop dhundho
      let nearestStop = null;
      let minStopDist = Infinity;
      for (let stop of route.stops) {
        const d = getDistance(passengerLoc, stop.location);
        if (d < minStopDist) {
          minStopDist = d;
          nearestStop = stop;
        }
      }

      if (minStopDist > 2000) continue; // 2km se zyada door hai stop

      const busToStopDist = getDistance(bus.currentLocation, nearestStop.location);
      const etaMins = Math.round((busToStopDist / 1000) / 35 * 60); // 35 km/h average

      if (etaMins < minETA) {
        minETA = etaMins;
        nearest = {
          busNumber: bus.busNumber,
          location: bus.currentLocation,
          distanceFromYou: Math.round(getDistance(passengerLoc, bus.currentLocation)),
          etaMinutes: etaMins,
          nextStop: nearestStop.name
        };
      }
    }

    if (!nearest) return res.json({ message: "No bus coming soon", nearestBus: null });
    res.json({ success: true, nearestBus: nearest });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Driver Location Update
app.put('/api/buses/:busNumber/location', authenticateToken, async (req, res) => {
  if (req.user.role !== 'driver') {
    return res.status(403).json({ error: "Only drivers allowed" });
  }

  const { lat, lng } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: "lat & lng required" });

  try {
    const updated = await Bus.findOneAndUpdate(
      { busNumber: req.params.busNumber },
      { 
        currentLocation: { lat: parseFloat(lat), lng: parseFloat(lng) },
        lastUpdated: new Date.now()
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "Bus not found" });
    res.json({ success: true, message: "Location updated", bus: updated });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple Login (temporary – baad mein badal dena)
app.post('/api/login', async (req, res) => {
  res.json({ message: "Login route ready – add your logic" });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Bus Tracking API Running on port ${PORT}`);
  console.log(`Live at: https://your-app.onrender.com`);
});
