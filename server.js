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

// Route & Stop (Design A)
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

// BusLive (active trip) and LiveLocation (history)
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
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  bearing: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
liveLocationSchema.index({ vehicle: 1, createdAt: -1 }); // efficient queries
const LiveLocation = mongoose.model('LiveLocation', liveLocationSchema);

// ----------------- Auth -----------------
const JWT_SECRET = process.env.JWT_SECRET || 'swiftride-secret-2025';

const authenticateToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: "Token required" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ success: false, error: "Invalid token" });
      req.user = user;
      next();
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ----------------- Basic Routes -----------------
app.get('/', (req, res) => {
  res.json({ message: "SwiftRide API Running!" });
});

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

// ----------------- Vehicle endpoints -----------------
// GET ALL ACTIVE BUSES (Passenger List)
app.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ isActive: true });
    res.json(vehicles.map(v => ({
      _id: v._id,
      number: v.number,
      driverName: v.driverName,
      currentLocation: v.currentLocation || { lat: null, lng: null }
    })));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET SINGLE BUS (by id)
app.get('/vehicles/:id', async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ success: false, error: "Bus not found" });

    res.json({
      _id: vehicle._id,
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

    res.json({ success: true, vehicle: { _id: vehicle._id, number } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- ROUTES & STOPS -----------------
// Create a stop
app.post('/api/stops', authenticateToken, async (req, res) => {
  try {
    const { name, lat, lng } = req.body;
    if (!name || lat == null || lng == null) return res.status(400).json({ success: false, error: "name, lat & lng required" });

    const stop = await Stop.create({ name, lat, lng });
    res.status(201).json({ success: true, stop });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get('/api/stops', async (req, res) => {
  try {
    const stops = await Stop.find().sort({ createdAt: -1 });
    res.json({ success: true, stops });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create a route
app.post('/api/routes', authenticateToken, async (req, res) => {
  try {
    const { name, from, to, stops } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name required" });

    const route = await RouteModel.create({ name, from, to, stops: stops || [] });
    res.status(201).json({ success: true, route });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get('/api/routes', async (req, res) => {
  try {
    const routes = await RouteModel.find().populate('stops');
    res.json({ success: true, routes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get('/api/routes/:id', async (req, res) => {
  try {
    const route = await RouteModel.findById(req.params.id).populate('stops');
    if (!route) return res.status(404).json({ success: false, error: "Route not found" });
    res.json({ success: true, route });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- BUSLIVES & LIVELOCATIONS -----------------
// Start a trip (create buslive)
app.post('/api/trips/start', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Only drivers allowed" });

    const { vehicleId, routeId } = req.body;
    if (!vehicleId) return res.status(400).json({ success: false, error: "vehicleId required" });

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return res.status(404).json({ success: false, error: "Vehicle not found" });

    const busLive = await BusLive.create({
      vehicle: vehicle._id,
      route: routeId || null,
      driverName: vehicle.driverName,
      startedAt: new Date(),
      isActive: true
    });

    res.json({ success: true, busLive });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get active buslives
app.get('/api/buslives', async (req, res) => {
  try {
    const lives = await BusLive.find({ isActive: true }).populate('vehicle route');
    res.json({ success: true, lives });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get livelocations (history)
app.get('/api/livelocations/:vehicleId', async (req, res) => {
  try {
    const vehicleId = req.params.vehicleId;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 1000);
    const locations = await LiveLocation.find({ vehicle: vehicleId }).sort({ createdAt: -1 }).limit(limit);
    res.json({ success: true, locations });
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
    console.log(`Client joined vehicle: ${vehicleId} (${socket.id})`);
  });

  socket.on('leaveVehicle', (vehicleId) => {
    if (!vehicleId) return;
    socket.leave(vehicleId.toString());
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ----------------- LOCATION UPDATE (driver) -----------------
// SINGLE route (no duplicates). This updates vehicle.currentLocation,
// saves history (LiveLocation), updates BusLive lastUpdated and emits socket.
app.put('/vehicles/:number/location', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver')
      return res.status(403).json({ success: false, error: "Unauthorized" });

    const { lat, lng, bearing, speed } = req.body;
    if (lat == null || lng == null)
      return res.status(400).json({ success: false, error: "lat & lng required" });

    const vehicleNumber = decodeURIComponent(req.params.number).trim();

    const vehicle = await Vehicle.findOneAndUpdate(
      { number: { $regex: new RegExp(`^${vehicleNumber}$`, "i") } },
      {
        currentLocation: {
          lat,
          lng,
          bearing: bearing || 0,
          updatedAt: new Date()
        },
        isActive: true
      },
      { new: true }
    );

    if (!vehicle)
      return res.status(404).json({ success: false, error: "Bus not found" });

    await LiveLocation.create({
      vehicle: vehicle._id,
      lat,
      lng,
      bearing: bearing || 0
    });

    await BusLive.findOneAndUpdate(
      { vehicle: vehicle._id, isActive: true },
      {
        lastUpdated: new Date(),
        bearing: bearing || 0,
        speed: speed || null
      }
    );

    io.to(vehicle._id.toString()).emit('locationUpdate', {
      lat,
      lng,
      bearing: bearing || 0,
      vehicleId: vehicle._id.toString(),
      timestamp: new Date()
    });

    res.json({ success: true, message: "Location updated" });

  } catch (err) {
    console.error("Location update error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});



// End trip
app.put('/vehicles/:number/deactivate', authenticateToken, async (req, res) => {
  try {
    const vehicleNumber = decodeURIComponent(req.params.number);
    const vehicle = await Vehicle.findOneAndUpdate({ number: vehicleNumber }, { isActive: false, currentLocation: null }, { new: true });
    if (vehicle) {
      await BusLive.updateMany({ vehicle: vehicle._id, isActive: true }, { isActive: false });
    }
    res.json({ success: true, message: "Trip ended" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- START SERVER -----------------
server.listen(PORT, () => {
  console.log(`SwiftRide Backend + Socket.IO Running on http://localhost:${PORT}`);
});
// SIMPLE LOCATION UPDATE ENDPOINT



