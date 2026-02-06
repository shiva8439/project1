// server.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connect
mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/swiftride", {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB Error:", err));

// ----------------- Schemas / Models -----------------
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String },
  role: { type: String, enum: ['driver', 'passenger'], default: 'passenger' }
});
const User = mongoose.model('User', userSchema);

const vehicleSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  driverName: { type: String, required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  from: String,
  to: String,
  currentLocation: {
    lat: Number,
    lng: Number,
    bearing: { type: Number, default: 0 },
    updatedAt: Date
  },
  isActive: { type: Boolean, default: true }
});
const Vehicle = mongoose.model('Vehicle', vehicleSchema);

const stopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Stop = mongoose.model('Stop', stopSchema);

const routeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  from: String,
  to: String,
  stops: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Stop' }],
  createdAt: { type: Date, default: Date.now }
});
const RouteModel = mongoose.model('Route', routeSchema);

const busLiveSchema = new mongoose.Schema({
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  route: { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
  driverName: String,
  startedAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  speed: Number,
  bearing: Number
});
const BusLive = mongoose.model('BusLive', busLiveSchema);

const liveLocationSchema = new mongoose.Schema({
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  busNumber: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  bearing: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now } // latest location ke liye
});
const LiveLocation = mongoose.model('LiveLocation', liveLocationSchema);

// ----------------- JWT Auth -----------------
const JWT_SECRET = process.env.JWT_SECRET || "swiftride-secret-2025";

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ success: false, error: "Invalid token" });
      req.user = user;
      next();
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ----------------- Basic Routes -----------------
app.get('/', (req, res) => res.json({ message: "College Bus Tracker API Running!" }));

// SIGNUP
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password, role, name } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: "Email & password required" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ success: false, error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password: hashed,
      role: role || 'passenger',
      name: name || email.split('@')[0]
    });

    res.status(201).json({
      success: true,
      message: "Account created",
      user: { email: user.email, role: user.role, name: user.name }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: { email: user.email, role: user.role, name: user.name || email.split('@')[0] }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- Vehicle Routes -----------------
// Passenger: Bus number se search (no auth)
app.get('/vehicles/search', async (req, res) => {
  try {
    const { number } = req.query;
    if (!number) return res.status(400).json({ success: false, error: "Bus number required" });

    const vehicles = await Vehicle.find({
      number: { $regex: new RegExp(`^${number.trim()}$`, 'i') },
      isActive: true
    }).limit(5);

    res.json({
      success: true,
      vehicles: vehicles.map(v => ({
        _id: v._id.toString(),
        number: v.number,
        driverName: v.driverName,
        currentLocation: v.currentLocation || { lat: null, lng: null }
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET ALL ACTIVE BUSES (for list if needed)
app.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ isActive: true });
    res.json(vehicles.map(v => ({
      _id: v._id.toString(),
      number: v.number,
      driverName: v.driverName,
      currentLocation: v.currentLocation || { lat: null, lng: null }
    })));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET SINGLE BUS by id
app.get('/vehicles/:id', async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ success: false, error: "Bus not found" });

    res.json({
      _id: vehicle._id.toString(),
      number: vehicle.number,
      driverName: vehicle.driverName,
      currentLocation: vehicle.currentLocation || { lat: null, lng: null }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DRIVER: REGISTER VEHICLE
app.post('/api/driver/register-vehicle', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Only drivers allowed" });

    const { number, driverName, from, to } = req.body;
    if (!number || !driverName) return res.status(400).json({ success: false, error: "Bus number & driver name required" });

    const exists = await Vehicle.findOne({ number });
    if (exists) return res.status(400).json({ success: false, error: "Bus already registered" });

    const vehicle = await Vehicle.create({
      number,
      driverName,
      driver: req.user.userId,
      from,
      to,
      isActive: true
    });

    res.json({ success: true, vehicle: { _id: vehicle._id.toString(), number } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DRIVER: GET MY VEHICLE (returns _id)
app.get('/api/driver/my-vehicle', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Only drivers allowed" });

    const vehicle = await Vehicle.findOne({ driver: req.user.userId });
    if (!vehicle) return res.status(404).json({ success: false, error: "No vehicle registered" });

    res.json({
      success: true,
      vehicle: {
        _id: vehicle._id.toString(),
        number: vehicle.number,
        driverName: vehicle.driverName,
        from: vehicle.from,
        to: vehicle.to
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DRIVER: UPDATE LOCATION (by vehicle _id)
app.put('/vehicles/:vehicleId/location', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Only drivers allowed" });

    const { lat, lng, bearing = 0, speed = null } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ success: false, error: "lat & lng required" });

    const vehicleId = req.params.vehicleId;

    // Ownership check
    const vehicle = await Vehicle.findOne({ _id: vehicleId, driver: req.user.userId });
    if (!vehicle) return res.status(404).json({ success: false, error: "Bus not found or not owned by you" });

    // Update current location
    vehicle.currentLocation = { lat, lng, bearing, updatedAt: new Date() };
    vehicle.isActive = true;
    await vehicle.save();

    // Save latest location (upsert - no duplicate key error)
    await LiveLocation.findOneAndUpdate(
      { vehicle: vehicle._id },
      { lat, lng, bearing, busNumber: vehicle.number, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    // Update BusLive if active trip
    await BusLive.findOneAndUpdate(
      { vehicle: vehicle._id, isActive: true },
      { lastUpdated: new Date(), speed, bearing }
    );

    // Broadcast to passengers in this vehicle room
    io.to(vehicle._id.toString()).emit('locationUpdate', {
      lat,
      lng,
      bearing,
      speed: speed || 0,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: "Location updated and broadcasted" });
  } catch (err) {
    console.error("Location update error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DRIVER: END TRIP / DEACTIVATE BUS
app.put('/vehicles/:vehicleId/deactivate', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Only drivers allowed" });

    const vehicleId = req.params.vehicleId;

    const vehicle = await Vehicle.findOne({ _id: vehicleId, driver: req.user.userId });
    if (!vehicle) return res.status(404).json({ success: false, error: "Bus not found or not owned by you" });

    vehicle.isActive = false;
    vehicle.currentLocation = null;
    await vehicle.save();

    await BusLive.updateMany(
      { vehicle: vehicle._id, isActive: true },
      { isActive: false }
    );

    io.to(vehicle._id.toString()).emit('tripEnded', { message: "Trip has ended" });

    res.json({ success: true, message: "Trip ended successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- SOCKET.IO SETUP -----------------
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('joinVehicle', (vehicleId) => {
    if (!vehicleId) return;
    socket.join(vehicleId.toString());
    console.log(`Client joined vehicle room: ${vehicleId} (${socket.id})`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ----------------- START SERVER -----------------
server.listen(PORT, () => {
  console.log(`College Bus Tracker Backend + Socket.IO Running on port ${PORT}`);
});
