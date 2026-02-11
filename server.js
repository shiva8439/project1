const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Socket.IO Setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB Error:", err));

// ----------------- MODELS -----------------
// User Model (for authentication)
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  name: String,
  role: { type: String, default: 'driver' }
});
const User = mongoose.model('User', userSchema);

// Route Model
const routeSchema = new mongoose.Schema({
  routeName: String,
  routeNumber: { type: String, unique: true, sparse: true },
  stops: [String]
});
const Route = mongoose.model('Route', routeSchema);

// Bus Model (with live location)
const busSchema = new mongoose.Schema({
  busNumber: { type: String, unique: true },
  driverName: String,
  route: { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
  currentStopIndex: { type: Number, default: 0 },
  location: {
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  isActive: { type: Boolean, default: true }
});
const Bus = mongoose.model('Bus', busSchema);

// Stop Model
const stopSchema = new mongoose.Schema({
  name: String,
  lat: Number,
  lng: Number
});
const Stop = mongoose.model('Stop', stopSchema);

// ----------------- API ROUTES -----------------

// AUTHENTICATION ENDPOINTS (unchanged)
app.post('/api/login', async (req, res) => { /* ... same as before ... */ });
app.post('/api/signup', async (req, res) => { /* ... same as before ... */ });
app.get('/api/auth/me', async (req, res) => { /* ... same as before ... */ });

// DRIVER VEHICLE ENDPOINTS (unchanged)
app.get('/api/driver/my-vehicle', async (req, res) => { /* ... same ... */ });
app.post('/api/driver/register-vehicle', async (req, res) => { /* ... same ... */ });

// STOPS & ROUTES (unchanged)
app.post('/api/stops', async (req, res) => { /* ... same ... */ });
app.get('/api/stops', async (req, res) => { /* ... same ... */ });
app.post('/api/routes', async (req, res) => { /* ... same ... */ });

// ───────────────────────────────────────────────
// EXISTING LOCATION UPDATE ENDPOINT (legacy / fallback)
app.put('/vehicles/:vehicleId/location', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { lat, lng, bearing } = req.body;
    
    console.log(`🚌 LOCATION UPDATE: Vehicle ${vehicleId} -> Lat: ${lat}, Lng: ${lng}`);
    
    if (lat == null || lng == null) {
      return res.status(400).json({ success: false, error: "Latitude and longitude required" });
    }

    let bus = await Bus.findById(vehicleId);
    if (!bus) {
      bus = await Bus.findOne({ busNumber: vehicleId });
    }
    
    if (!bus) {
      return res.status(404).json({ success: false, error: "Vehicle not found" });
    }

    bus.location.latitude = lat;
    bus.location.longitude = lng;
    bus.location.lastUpdated = new Date();
    await bus.save();

    console.log(`✅ Bus ${bus.busNumber} location updated in database`);

    io.emit('locationUpdate', {
      lat,
      lng,
      bearing: bearing || 0,
      busId: vehicleId,
      busNumber: bus.busNumber
    });

    io.emit(`bus-${bus.busNumber}`, {
      type: 'location_update',
      busNumber: bus.busNumber,
      location: { latitude: lat, longitude: lng, lastUpdated: new Date() }
    });

    res.json({ success: true, message: "Location updated successfully", busNumber: bus.busNumber });
  } catch (err) {
    console.error(`❌ LOCATION UPDATE ERROR: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ───────────────────────────────────────────────
// NEW ENDPOINT - Recommended for your current Driver Flutter app
// Matches exactly what many Flutter apps are calling: /bus/:busNumber/location
app.put('/bus/:busNumber/location', async (req, res) => {
  try {
    const { busNumber } = req.params;
    const { lat, lng, bearing } = req.body;
    
    console.log(`🚌 DRIVER LOCATION UPDATE: Bus ${busNumber} -> Lat: ${lat}, Lng: ${lng}`);
    
    if (lat == null || lng == null) {
      return res.status(400).json({ 
        success: false, 
        error: "Latitude and longitude required" 
      });
    }

    const bus = await Bus.findOne({ busNumber: busNumber });
    if (!bus) {
      console.log(`❌ Bus ${busNumber} not found`);
      return res.status(404).json({ 
        success: false, 
        error: "Bus not found" 
      });
    }

    bus.location.latitude = lat;
    bus.location.longitude = lng;
    bus.location.lastUpdated = new Date();
    await bus.save();

    console.log(`✅ Bus ${bus.busNumber} location updated in database`);

    // Emit to all (legacy + room)
    io.emit('locationUpdate', {
      lat,
      lng,
      bearing: bearing || 0,
      busId: bus._id.toString(),
      busNumber: bus.busNumber
    });

    io.emit(`bus-${bus.busNumber}`, {
      type: 'location_update',
      busNumber: bus.busNumber,
      location: {
        latitude: lat,
        longitude: lng,
        lastUpdated: new Date()
      }
    });

    console.log(`📡 Emitted location update to passengers`);

    res.json({
      success: true,
      message: "Location updated successfully",
      busNumber: bus.busNumber
    });
  } catch (err) {
    console.error(`❌ Location update error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ───────────────────────────────────────────────
// Other existing endpoints (unchanged)
app.get('/vehicles/search', async (req, res) => { /* ... same ... */ });
app.get('/', (req, res) => { /* ... same ... */ });
app.get('/debug/buses', async (req, res) => { /* ... same ... */ });
app.get('/buses', async (req, res) => { /* ... same ... */ });
app.get('/bus/track/:busNumber', async (req, res) => { /* ... same ... */ });
app.put('/bus/stop/:busNumber', async (req, res) => { /* ... same ... */ });

// SOCKET.IO (unchanged)
io.on('connection', (socket) => {
  console.log('📱 User connected:', socket.id);

  socket.on('join-bus', (busNumber) => {
    socket.join(`bus-${busNumber}`);
    console.log(`🚌 User joined bus ${busNumber} room`);
  });

  socket.on('joinVehicle', (busId) => {
    socket.join(`bus-${busId}`);
    console.log(`🚌 User joined vehicle ${busId} room`);
  });

  socket.on('driver-location-update', (data) => {
    console.log('📍 Driver location update received:', data);
    io.emit('locationUpdate', data);
    io.emit(`bus-${data.busNumber}`, {
      type: 'location_update',
      busNumber: data.busNumber,
      location: {
        latitude: data.lat,
        longitude: data.lng,
        lastUpdated: new Date()
      }
    });
  });

  socket.on('leave-bus', (busNumber) => {
    socket.leave(`bus-${busNumber}`);
    console.log(`🚌 User left bus ${busNumber} room`);
  });

  socket.on('disconnect', () => {
    console.log('📱 User disconnected:', socket.id);
  });
});

// START SERVER
server.listen(PORT, () => {
  console.log(`🚌 Live Bus Tracker Backend Running on port ${PORT}`);
  console.log(`📍 Track Bus: http://localhost:${PORT}/bus/track/UP15`);
  console.log(`📱 Live Updates: Socket.IO connected`);
  console.log(`🔗 All Buses: http://localhost:${PORT}/buses`);
  console.log(`📍 New driver location endpoint: PUT /bus/:busNumber/location`);
});
