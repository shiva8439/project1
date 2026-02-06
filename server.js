// server.js - Modified for "Where is my Train" style tracking

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

// ----------------- Import Models -----------------
const User = require('./User');
const Stop = require('./Stop');
const Route = require('./Route');
const Bus = require('./Bus');
const LiveLocation = require('./Livelocation');

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

// SIGNUP (same as before)
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

// LOGIN (same as before)
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

// ----------------- PASSENGER TRACKING - "Where is my Train" style -----------------

// Main endpoint: Bus number se pura tracking (current stop, upcoming, progress, etc.)
app.get('/api/passenger/track/:busNumber', async (req, res) => {
  try {
    const busNumber = req.params.busNumber.trim().toUpperCase();

    // Find the bus
    const bus = await Bus.findOne({ busNumber })
      .populate('route')
      .populate('stops')
      .populate('driverId', 'name')
      .populate('lastStopReached', 'name lat lng');

    if (!bus) {
      return res.status(404).json({ success: false, error: "Bus not found" });
    }

    // Get latest live location
    const liveLocation = await LiveLocation.findOne({ busId: bus._id }).sort({ updatedAt: -1 });

    // Stops sequence & progress
    const allStops = bus.stops || [];
    const currentIndex = bus.currentStopIndex || -1;

    let currentStop = null;
    let upcomingStops = [];
    let completedStops = [];

    if (currentIndex >= 0 && currentIndex < allStops.length) {
      currentStop = allStops[currentIndex];
      upcomingStops = allStops.slice(currentIndex + 1);
      completedStops = allStops.slice(0, currentIndex);
    } else if (currentIndex === -1) {
      upcomingStops = allStops;
    } else {
      completedStops = allStops;
    }

    // Bus status
    let status = "Not Started";
    if (currentIndex >= 0 && currentIndex < allStops.length) status = "Running";
    if (currentIndex >= allStops.length) status = "Completed";

    // Response in "Where is my Train" style
    res.json({
      success: true,
      bus: {
        busNumber: bus.busNumber,
        driverName: bus.driverId?.name || "Unknown",
        routeName: bus.route?.routeName || "N/A",
        status: status,
        isActive: bus.isActive || false,
      },
      location: liveLocation ? {
        latitude: liveLocation.latitude,
        longitude: liveLocation.longitude,
        updatedAt: liveLocation.updatedAt
      } : {
        latitude: bus.location?.latitude || 0,
        longitude: bus.location?.longitude || 0,
        updatedAt: bus.location?.updatedAt || new Date()
      },
      stopsProgress: {
        totalStops: allStops.length,
        completed: completedStops.length,
        currentIndex: currentIndex,
        progressPercent: allStops.length > 0 ? Math.round((completedStops.length / allStops.length) * 100) : 0,
        nextStop: upcomingStops.length > 0 ? upcomingStops[0].name : "End of Route"
      },
      currentStop: currentStop ? {
        name: currentStop.name,
        lat: currentStop.lat,
        lng: currentStop.lng,
        order: currentIndex + 1
      } : null,
      upcomingStops: upcomingStops.map((stop, idx) => ({
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        order: currentIndex + idx + 2
      })),
      completedStops: completedStops.map((stop, idx) => ({
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        order: idx + 1
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Driver: Update location (same as before, but with socket broadcast)
app.put('/api/driver/bus/:busId/location', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Only drivers allowed" });

    const { latitude, longitude } = req.body;
    if (latitude == null || longitude == null) return res.status(400).json({ success: false, error: "latitude & longitude required" });

    const busId = req.params.busId;

    const bus = await Bus.findOne({ _id: busId, driverId: req.user.userId });
    if (!bus) return res.status(404).json({ success: false, error: "Bus not found or not owned by you" });

    bus.location = { latitude, longitude, updatedAt: new Date() };
    await bus.save();

    // Save to live locations
    await LiveLocation.findOneAndUpdate(
      { busId: bus._id },
      { busId: bus._id, busNumber: bus.busNumber, latitude, longitude, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    // Broadcast to passengers
    io.to(bus._id.toString()).emit('locationUpdate', {
      busId: bus._id.toString(),
      busNumber: bus.busNumber,
      latitude,
      longitude,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: "Location updated and broadcasted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Driver: Mark stop reached (broadcast to passengers)
app.put('/api/driver/bus/:busId/reach-stop', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Only drivers allowed" });

    const { stopIndex } = req.body;
    const busId = req.params.busId;

    if (stopIndex == null || stopIndex < 0) return res.status(400).json({ success: false, error: "Valid stop index required" });

    const bus = await Bus.findOne({ _id: busId, driverId: req.user.userId }).populate('stops');
    if (!bus) return res.status(404).json({ success: false, error: "Bus not found or not owned by you" });

    if (stopIndex >= bus.stops.length) return res.status(400).json({ success: false, error: "Invalid stop index" });

    bus.currentStopIndex = stopIndex;
    bus.lastStopReached = bus.stops[stopIndex]._id;
    await bus.save();

    const reachedStop = bus.stops[stopIndex];

    // Broadcast to passengers
    io.to(bus._id.toString()).emit('stopReached', {
      busId: bus._id.toString(),
      busNumber: bus.busNumber,
      stop: {
        name: reachedStop.name,
        lat: reachedStop.lat,
        lng: reachedStop.lng
      },
      stopIndex,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: "Stop reached updated",
      currentStop: {
        name: reachedStop.name,
        lat: reachedStop.lat,
        lng: reachedStop.lng
      },
      stopIndex
    });
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

  socket.on('joinVehicle', (busId) => {
    if (!busId) return;
    socket.join(busId.toString());
    console.log(`Client joined bus room: ${busId} (${socket.id})`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ----------------- START SERVER -----------------
server.listen(PORT, () => {
  console.log(`College Bus Tracker Backend + Socket.IO Running on port ${PORT}`);
});

