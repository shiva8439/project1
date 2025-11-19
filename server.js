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
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => {
    console.log('DB Error:', err.message);
    process.exit(1);
  });

// ==================== ALL MODELS (Ek hi file mein) ====================

const User = mongoose.model('User', new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['passenger', 'driver'], default: 'passenger' },
  createdAt: { type: Date, default: Date.now }
}));

const Stop = mongoose.model('Stop', new mongoose.Schema({
  name: String,
  location: { lat: Number, lng: Number }
}));

const Route = mongoose.model('Route', new mongoose.Schema({
  routeName: String,
  routeNumber: String,
  stops: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Stop' }]
}));

const Bus = mongoose.model('Bus', new mongoose.Schema({
  busNumber: { type: String, required: true, unique: true },
  route: { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
  currentLocation: { lat: Number, lng: Number },
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now }
}));

const Vehicle = mongoose.model('Vehicle', new mongoose.Schema({
  name: String,
  type: String,
  number: { type: String, required: true, unique: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  currentLocation: { lat: Number, lng: Number },
  isAvailable: { type: Boolean, default: true }
}));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'swiftRideSecret2025';

// Auth Middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Token chahiye" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token galat hai" });
    req.user = user;
    next();
  });
};

// Haversine Distance
const getDistance = (a, b) => {
  const toRad = x => x * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
};

// ==================== ROUTES ====================

app.get('/', (req, res) => {
  res.json({ message: "SwiftRide API LIVE", time: new Date().toLocaleString('en-IN') });
});

// SIGNUP
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email & password daalo" });

    if (await User.findOne({ email })) return res.status(400).json({ error: "Email already registered" });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash, role: role || 'passenger' });

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
    if (!email || !password) return res.status(400).json({ error: "Email & password daalo" });

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Email ya password galat" });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: "Login successful!",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET ALL ROUTES
app.get('/api/routes', async (req, res) => {
  try {
    const routes = await Route.find().populate('stops');
    res.json({ success: true, routes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// NEAREST BUS
app.post('/api/nearest-bus', async (req, res) => {
  try {
    const { lat, lng, routeId } = req.body;
    if (!lat || !lng || !routeId) return res.status(400).json({ error: "Location & routeId daalo" });

    const passenger = { lat: parseFloat(lat), lng: parseFloat(lng) };
    const route = await Route.findById(routeId).populate('stops');
    if (!route) return res.status(404).json({ error: "Route nahi mila" });

    const buses = await Bus.find({ route: routeId, isActive: true });
    if (!buses.length) return res.json({ nearestBus: null });

    let best = null;
    let minETA = Infinity;

    for (let bus of buses) {
      let nearestStop = null;
      let minStopDist = Infinity;

      for (let stop of route.stops) {
        const d = getDistance(passenger, stop.location);
        if (d < minStopDist) {
          minStopDist = d;
          nearestStop = stop;
        }
      }
      if (minStopDist > 2000) continue;

      const eta = Math.round(getDistance(bus.currentLocation, nearestStop.location) / 1000 / 35 * 60);

      if (eta < minETA) {
        minETA = eta;
        best = {
          busNumber: bus.busNumber,
          location: bus.currentLocation,
          etaMinutes: eta,
          nextStop: nearestStop.name
        };
      }
    }
    res.json({ success: true, nearestBus: best });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ADD VEHICLE (Driver only)
app.post('/vehicles', auth, async (req, res) => {
  if (req.user.role !== 'driver') return res.status(403).json({ error: "Driver only" });

  try {
    const { name, type, number, lat, lng } = req.body;
    const vehicle = await Vehicle.create({
      name, type, number,
      driver: req.user.userId,
      currentLocation: { lat, lng }
    });
    res.status(201).json({ success: true, vehicle });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// UPDATE VEHICLE LOCATION
app.put('/vehicles/:id/location', auth, async (req, res) => {
  if (req.user.role !== 'driver') return res.status(403).json({ error: "Driver only" });

  const { lat, lng } = req.body;
  const vehicle = await Vehicle.findOneAndUpdate(
    { _id: req.params.id, driver: req.user.userId },
    { currentLocation: { lat, lng } },
    { new: true }
  );
  if (!vehicle) return res.status(404).json({ error: "Vehicle nahi mila" });
  res.json({ success: true, vehicle });
});

// GET ALL VEHICLES
app.get('/vehicles', async (req, res) => {
  const vehicles = await Vehicle.find({ isAvailable: true })
    .populate('driver', 'name email')
    .select('name type number currentLocation');
  res.json(vehicles);
});

// Start Server
app.listen(PORT, () => {
  console.log(`SwiftRide API chal raha hai: https://project1-13.onrender.com`);
  console.log(`Login: POST /api/login`);
});
