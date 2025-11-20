const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connect
mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/swiftride")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB Error:", err));

// Schemas
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
    lng: Number
  },
  isActive: { type: Boolean, default: true }
});
const Vehicle = mongoose.model('Vehicle', vehicleSchema);

const JWT_SECRET = process.env.JWT_SECRET || 'swiftride-secret-2025';

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: "Token required" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, error: "Invalid token" });
    req.user = user;
    next();
  });
};

// Routes

app.get('/', (req, res) => {
  res.json({ message: "SwiftRide API Running!" });
});

// SIGNUP - Fixed response format
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

// LOGIN - Fixed response format
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
      user: {
        email: user.email,
        role: user.role,
        name: user.name || email.split('@')[0]
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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

// GET SINGLE BUS LOCATION (PassengerPanel)
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

// DRIVER: CREATE / REGISTER BUS (First time)
app.post('/api/driver/register-vehicle', authenticateToken, async (req, res) => {
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
});

// DRIVER: UPDATE LOCATION (By Bus Number → Changed to _id in Flutter later)
app.put('/vehicles/:number/location', authenticateToken, async (req, res) => {
  if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Unauthorized" });

  const { lat, lng } = req.body;
  if (!lat || !lng) return res.status(400).json({ success: false, error: "lat & lng required" });

  const vehicle = await Vehicle.findOneAndUpdate(
    { number: req.params.number },
    { currentLocation: { lat, lng } },
    { new: true }
  );

  if (!vehicle) return res.status(404).json({ success: false, error: "Bus not found" });

  res.json({ success: true, message: "Location updated" });
});
// ==================== SOCKET.IO ADD KAR DE (ye missing tha!!!)
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Jab location update hoti hai tab sabko batao
app.put('/vehicles/:number/location', authenticateToken, async (req, res) => {
  if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Unauthorized" });

  const { lat, lng, bearing } = req.body;
  if (lat == null || lng == null) return res.status(400).json({ success: false, error: "lat & lng required" });

  const vehicle = await Vehicle.findOneAndUpdate(
    { number: req.params.number },
    { 
      currentLocation: { lat, lng },
      $set: { 'currentLocation.bearing': bearing || 0 }
    },
    { new: true }
  );

  if (!vehicle) return res.status(404).json({ success: false, error: "Bus not found" });

  // YE LINE SABSE ZAROORI HAI – SAB PASSENGERS KO LIVE LOCATION BHEJO!!!
  io.to(vehicle._id.toString()).emit('locationUpdate', {
    lat,
    lng,
    bearing: bearing || 0
  });

  res.json({ success: true, message: "Location updated" });
});

// Socket connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('joinVehicle', (vehicleId) => {
    socket.join(vehicleId);
    console.log(`Client joined vehicle: ${vehicleId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// app.listen ki jagah server.listen karo
server.listen(PORT, () => {
  console.log(`SwiftRide Backend + Socket.IO Running on http://localhost:${PORT}`);
});
// Optional: End trip
app.put('/vehicles/:number/deactivate', authenticateToken, async (req, res) => {
  await Vehicle.updateOne({ number: req.params.number }, { isActive: false, currentLocation: null });
  res.json({ success: true, message: "Trip ended" });
});
