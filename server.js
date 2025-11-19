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

// MongoDB Connect
mongoose.connect(process.env.MONGO_URI || "mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/swiftride?retryWrites=true&w=majority")
  .then(() => console.log('MongoDB Connected'))
  .catch(err => {
    console.log('DB Error:', err.message);
    process.exit(1);
  });

// ==================== ALL MODELS (Direct in server.js) ====================

const User = mongoose.model('User', new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['passenger', 'driver'], default: 'passenger' },
  createdAt: { type: Date, default: Date.now }
}));

const Stop = mongoose.model('Stop', new mongoose.Schema({
  name: String,
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  }
}));

const Route = mongoose.model('Route', new mongoose.Schema({
  routeName: String,
  routeNumber: String,
  stops: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Stop' }]
}));

const Bus = mongoose.model('Bus', new mongoose.Schema({
  busNumber: { type: String, required: true, unique: true },
  route: { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
  currentLocation: {
    lat: Number,
    lng: Number
  },
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now }
}));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'swiftRideSuperSecret2025';

// JWT Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Login karo pehle" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token galat hai" });
    req.user = user;
    next();
  });
};

// Haversine Distance (meter mein)
const getDistance = (loc1, loc2) => {
  const toRad = (x) => x * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(loc2.lat - loc1.lat);
  const dLon = toRad(loc2.lng - loc1.lng);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) * Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// ==================== ROUTES ====================

app.get('/', (req, res) => {
  res.json({ 
    message: "SwiftRide Bus Tracker API LIVE", 
    time: new Date().toLocaleString('en-IN'),
    docs: "https://project1-13.onrender.com/api/*"
  });
});

// SIGNUP
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email aur password daalo" });

    if (await User.findOne({ email })) return res.status(400).json({ error: "Email already used" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, role: role || 'passenger' });

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: "Account ban gaya!",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email aur password daalo" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Email galat hai" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Password galat hai" });

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: "Login ho gaya!",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ALL ROUTES
app.get('/api/routes', async (req, res) => {
  try {
    const routes = await Route.find().populate('stops');
    res.json({ success: true, count: routes.length, routes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ALL STOPS
app.get('/api/stops', async (req, res) => {
  try {
    const stops = await Stop.find();
    res.json({ success: true, count: stops.length, stops });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// NEAREST BUS
app.post('/api/nearest-bus', async (req, res) => {
  try {
    const { lat, lng, routeId } = req.body;
    if (!lat || !lng || !routeId) return res.status(400).json({ error: "Location aur routeId daalo" });

    const passengerLoc = { lat: parseFloat(lat), lng: parseFloat(lng) };
    const route = await Route.findById(routeId).populate('stops');
    if (!route) return res.status(404).json({ error: "Route nahi mila" });

    const buses = await Bus.find({ route: routeId, isActive: true });
    if (buses.length === 0) return res.json({ message: "Is route pe koi bus nahi hai", nearestBus: null });

    let best = null;
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
      if (minDist > 2000) continue; // 2km se zyada door

      const distToStop = getDistance(bus.currentLocation, nearestStop.location);
      const eta = Math.round((distToStop / 1000) / 35 * 60); // 35 km/h

      if (eta < minETA) {
        minETA = eta;
        best = {
          busNumber: bus.busNumber,
          location: bus.currentLocation,
          etaMinutes: eta,
          nextStop: nearestStop.name,
          distanceFromYou: Math.round(getDistance(passengerLoc, bus.currentLocation))
        };
      }
    }

    res.json({ success: true, nearestBus: best || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DRIVER: Update Bus Location
app.put('/api/buses/:busNumber/location', authenticate, async (req, res) => {
  if (req.user.role !== 'driver') return res.status(403).json({ error: "Sirf driver kar sakta hai" });

  const { lat, lng } = req.body;
  const { busNumber } = req.params;

  try {
    const bus = await Bus.findOneAndUpdate(
      { busNumber },
      { currentLocation: { lat: parseFloat(lat), lng: parseFloat(lng) }, lastUpdated: new Date() },
      { new: true }
    );

    if (!bus) return res.status(404).json({ error: "Bus nahi mili" });
    res.json({ success: true, message: "Location update ho gaya", bus });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Server Start
app.listen(PORT, () => {
  console.log(`SwiftRide API chal raha hai: https://project1-13.onrender.com`);
  console.log(`Login URL: https://project1-13.onrender.com/api/login`);
});

module.exports = app;
