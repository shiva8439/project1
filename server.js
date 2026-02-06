// server.js - Full backend for BusI (Driver + Passenger "Where is my Train" style)

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/busitrack", {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch(err => console.log("MongoDB Connection Error:", err));

// Models (yeh files alag se banani padengi)
const User = require('./User');
const Bus = require('./Bus');
const Stop = require('./Stop');
const Route = require('./Route');
const LiveLocation = require('./Livelocation');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "busitrack-secret-key-2025";

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ==================== BASIC ROUTES ====================
app.get('/', (req, res) => {
  res.json({ message: 'BusI Backend Running - Where is my Bus API' });
});

// SIGNUP
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password, role, name } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email & password required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, error: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password: hashed,
      role: role || 'driver',
      name: name || email.split('@')[0]
    });

    res.status(201).json({ success: true, message: 'Account created', user: { email: user.email, role: user.role } });
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
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      token,
      user: { email: user.email, role: user.role, name: user.name }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== PASSENGER TRACKING - "Where is my Train" style ====================
app.get('/api/passenger/track/:busNumber', async (req, res) => {
  try {
    const busNumber = req.params.busNumber.trim().toUpperCase();

    const bus = await Bus.findOne({ busNumber })
      .populate('route')
      .populate('stops')
      .populate('driverId', 'name');

    if (!bus) return res.status(404).json({ success: false, error: 'Bus not found' });

    const liveLocation = await LiveLocation.findOne({ busId: bus._id }).sort({ updatedAt: -1 });

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

    let status = currentIndex === -1 ? 'Not Started' :
                 currentIndex >= allStops.length ? 'Completed' : 'Running';

    res.json({
      success: true,
      bus: {
        busNumber: bus.busNumber,
        driverName: bus.driverId?.name || 'Unknown',
        routeName: bus.route?.routeName || 'N/A',
        status,
        isActive: bus.isActive || false,
      },
      location: liveLocation ? {
        latitude: liveLocation.latitude,
        longitude: liveLocation.longitude,
        updatedAt: liveLocation.updatedAt
      } : null,
      stops: {
        total: allStops.length,
        completed: completedStops.length,
        current: currentStop ? {
          name: currentStop.name,
          lat: currentStop.lat,
          lng: currentStop.lng
        } : null,
        upcoming: upcomingStops.map(s => ({ name: s.name, lat: s.lat, lng: s.lng })),
        completed: completedStops.map(s => ({ name: s.name, lat: s.lat, lng: s.lng }))
      },
      progress: {
        percentage: allStops.length > 0 ? Math.round((completedStops.length / allStops.length) * 100) : 0,
        nextStop: upcomingStops.length > 0 ? upcomingStops[0].name : 'End of Route'
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== DRIVER ROUTES ====================
app.get('/api/driver/my-vehicle', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: 'Only drivers allowed' });

    const vehicle = await Bus.findOne({ driverId: req.user.userId });
    if (!vehicle) return res.status(404).json({ success: false, error: 'No vehicle registered' });

    res.json({ success: true, vehicle });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/driver/register-vehicle', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: 'Only drivers allowed' });

    const { number, driverName, from, to } = req.body;
    if (!number) return res.status(400).json({ success: false, error: 'Bus number required' });

    const existing = await Bus.findOne({ busNumber: number.trim() });
    if (existing) return res.status(400).json({ success: false, error: 'Bus number already registered' });

    const bus = await Bus.create({
      busNumber: number.trim(),
      driverId: req.user.userId,
      driverName: driverName || 'Unknown',
      from: from || '',
      to: to || '',
      location: { latitude: 0, longitude: 0 }
    });

    res.status(201).json({ success: true, vehicle: bus });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/driver/bus/:busId/location', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: 'Only drivers allowed' });

    const { lat, lng } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ success: false, error: 'Location required' });

    const bus = await Bus.findOneAndUpdate(
      { _id: req.params.busId, driverId: req.user.userId },
      { location: { latitude: lat, longitude: lng, updatedAt: new Date() } },
      { new: true }
    );

    if (!bus) return res.status(404).json({ success: false, error: 'Bus not found' });

    // Broadcast via socket
    io.to(bus._id.toString()).emit('locationUpdate', {
      busId: bus._id.toString(),
      lat,
      lng,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: 'Location updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== SOCKET.IO ====================
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('joinVehicle', (busId) => {
    if (busId) {
      socket.join(busId.toString());
      console.log(`Client joined bus: ${busId}`);
    }
  });

  socket.on('disconnect', () => console.log('Client disconnected'));
});

// ==================== START SERVER ====================
server.listen(PORT, () => {
  console.log(`BusI Backend running on port ${PORT}`);
});



