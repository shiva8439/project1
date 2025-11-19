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
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected'))
.catch(err => {
  console.log('MongoDB Error:', err.message);
  process.exit(1);
});

// Import Models (models folder mein hone chahiye)
const User = require('./models/User');
const Bus = require('./models/Bus');
const Stop = require('./models/Stop');
const Route = require('./models/Route');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'swiftRideSecret2025';

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Token required" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

// Haversine Distance
const getDistance = (loc1, loc2) => {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(loc2.lat - loc1.lat);
  const dLon = toRad(loc2.lng - loc1.lng);
  const a = Math.sin(dLat/2)**2 + 
            Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) * 
            Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// ==================== ROUTES ====================

app.get('/', (req, res) => {
  res.json({ message: "SwiftRide Bus Tracking API - LIVE!" });
});

// ==================== AUTH ====================

// Signup
app.post('/api/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email & password required" });

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'passenger' // passenger ya driver
    });

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: "User created successfully",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email & password required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== BUS TRACKING ====================

app.get('/api/routes', async (req, res) => {
  try {
    const routes = await Route.find().populate('stops');
    res.json({ success: true, routes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stops', async (req, res) => {
  try {
    const stops = await Stop.find();
    res.json({ success: true, stops });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/routes/:routeId/buses', async (req, res) => {
  try {
    const buses = await Bus.find({ route: req.params.routeId, isActive: true });
    res.json({ success: true, buses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Nearest Bus
app.post('/api/nearest-bus', async (req, res) => {
  const { lat, lng, routeId } = req.body;
  if (!lat || !lng || !routeId) return res.status(400).json({ error: "lat, lng, routeId required" });

  try {
    const passengerLoc = { lat: parseFloat(lat), lng: parseFloat(lng) };
    const route = await Route.findById(routeId).populate('stops');
    if (!route) return res.status(404).json({ error: "Route not found" });

    const buses = await Bus.find({ route: routeId, isActive: true });
    if (buses.length === 0) return res.json({ message: "No bus on route", nearestBus: null });

    let nearestBus = null;
    let minETA = Infinity;

    for (let bus of buses) {
      let nearestStop = null;
      let minDist = Infinity;
      for (let stop of route.stops) {
        const d = getDistance(passengerLoc, stop.location);
        if (d < minDist) {
          minDist = d;
          nearestStop = stop;
        }
      }

      if (minDist > 2000) continue;

      const busToStop = getDistance(bus.currentLocation, nearestStop.location);
      const eta = Math.round((busToStop / 1000) / 35 * 60);

      if (eta < minETA) {
        minETA = eta;
        nearestBus = {
          busNumber: bus.busNumber,
          location: bus.currentLocation,
          etaMinutes: eta,
          nextStop: nearestStop.name,
          distanceFromYou: Math.round(getDistance(passengerLoc, bus.currentLocation))
        };
      }
    }

    res.json({ success: true, nearestBus: nearestBus || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Driver: Update Location
app.put('/api/buses/:busNumber/location', authenticateToken, async (req, res) => {
  if (req.user.role !== 'driver') return res.status(403).json({ error: "Driver only" });

  const { lat, lng } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: "lat & lng required" });

  try {
    const bus = await Bus.findOneAndUpdate(
      { busNumber: req.params.busNumber },
      { currentLocation: { lat: parseFloat(lat), lng: parseFloat(lng) }, lastUpdated: new Date() },
      { new: true }
    );

    if (!bus) return res.status(404).json({ error: "Bus not found" });
    res.json({ success: true, message: "Location updated", bus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`SwiftRide API Running on port ${PORT}`);
  console.log(`Live URL: https://your-app.onrender.com`);
});
