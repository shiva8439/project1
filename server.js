// server.js → FINAL 100% WORKING VERSION (NO ERROR)
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// MongoDB Connect
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('MongoDB Error:', err));

// ==================== MODELS ====================

// User Model (CORRECTED)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['driver', 'passenger'], default: 'passenger' },
  name: String,
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Bus Live Tracking Model
const busLiveSchema = new mongoose.Schema({
  busNumber: { type: String, required: true, unique: true },
  driverName: { type: String, required: true },
  route: { type: String, default: "Unknown Route" },
  currentLocation: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  speed: { type: Number, default: 0 },
  nextStop: { type: String, default: "Next Stop" },
  etaToNextStop: { type: Number, default: 5 },
  delay: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now }
});
const BusLive = mongoose.model('BusLive', busLiveSchema);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'swiftRideSecureKey2025ChangeThis';

// Auth Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: "Token required" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: "Invalid token" });
    req.user = user;
    next();
  });
};

// ==================== ROUTES ====================

app.get('/', (req, res) => {
  res.json({ message: 'SwiftRide Backend LIVE', status: 'OK', time: new Date().toLocaleString('en-IN') });
});

// Signup
app.post('/signup', async (req, res) => {
  try {
    const { email, password, role = 'passenger', name } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Email & password required" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: "User already exists" });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ email, password: hashed, role, name });

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: "Account created",
      token,
      user: { id: user._id, email: user.email, name: user.name || "User", role: user.role }
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: { id: user._id, email: user.email, name: user.name || "User", role: user.role }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get all live buses
app.get('/buses', async (req, res) => {
  try {
    const buses = await BusLive.find({ isActive: true }).sort({ lastUpdated: -1 });
    res.json(buses);
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Get single bus by number
app.get('/bus/:busNumber', async (req, res) => {
  try {
  const bus = await BusLive.findOne({ busNumber: req.params.busNumber });
    if (!bus) return res.status(404).json({ success: false, message: "Bus not found" });
    res.json(bus);
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Driver: Start Trip
app.post('/driver/start-trip', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false });

    const { busNumber, driverName, route } = req.body;
    if (!busNumber || !driverName) return res.status(400).json({ success: false });

    await BusLive.updateOne(
      { busNumber },
      { busNumber, driverName, route, isActive: true, lastUpdated: new Date() },
      { upsert: true }
    );

    res.json({ success: true, message: "Trip started" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Driver: Send Live Location
app.post('/driver/location', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false });

    const { busNumber, lat, lng, speed = 0, nextStop = "Next Stop", etaToNextStop = 5, delay = 0 } = req.body;

    if (!busNumber || lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: "busNumber, lat, lng required" });
    }

    await BusLive.updateOne(
      { busNumber },
      {
        currentLocation: { lat, lng },
        speed: Math.round(speed),
        nextStop,
        etaToNextStop,
        delay,
        lastUpdated: new Date()
      },
      { upsert: true }
    );

    res.json({ success: true, message: "Location updated" });
  } catch (err) {
    console.log("Location error:", err);
    res.status(500).json({ success: false });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`SwiftRide Backend LIVE on port ${PORT}`);
});
