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
// Route Model
const routeSchema = new mongoose.Schema({
  routeName: String,
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

// ----------------- API ROUTES -----------------

// ✅ HOME PAGE - All available buses
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: "🚌 Live Bus Tracker Backend",
    features: [
      "📱 Live location tracking",
      "📍 Current stop display", 
      "🗺️ Real-time updates",
      "🔍 Bus number search"
    ],
    endpoints: {
      track: "GET /bus/track/:busNumber",
      updateLocation: "PUT /bus/location/:busNumber",
      updateStop: "PUT /bus/stop/:busNumber",
      allBuses: "GET /buses",
      addBus: "POST /bus/add"
    }
  });
});

// ✅ GET ALL BUSES (For selection)
app.get('/buses', async (req, res) => {
  try {
    const buses = await Bus.find({ isActive: true }).populate('route');
    
    res.json({
      success: true,
      buses: buses.map(bus => ({
        _id: bus._id,
        busNumber: bus.busNumber,
        driverName: bus.driverName || "Driver",
        routeName: bus.route?.routeName || "No Route",
        currentStop: bus.route ? bus.route.stops[bus.currentStopIndex] : "No Route",
        isLive: bus.location.lastUpdated > new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        lastSeen: bus.location.lastUpdated
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ TRACK SPECIFIC BUS (Main endpoint)
app.get('/bus/track/:busNumber', async (req, res) => {
  try {
    const bus = await Bus.findOne({ busNumber: req.params.busNumber })
      .populate('route');

    if (!bus) {
      return res.status(404).json({ 
        success: false,
        error: "Bus not found" 
      });
    }

    const currentStop = bus.route ? bus.route.stops[bus.currentStopIndex] : "No Route";
    const nextStop = bus.route ? bus.route.stops[bus.currentStopIndex + 1] : "No Route";
    const isLive = bus.location.lastUpdated > new Date(Date.now() - 2 * 60 * 1000); // Last 2 minutes

    res.json({
      success: true,
      bus: {
        busNumber: bus.busNumber,
        driverName: bus.driverName || "Driver",
        currentStop: currentStop,
        nextStop: nextStop || "Last Stop",
        location: {
          latitude: bus.location.latitude,
          longitude: bus.location.longitude,
          lastUpdated: bus.location.lastUpdated
        },
        status: isLive ? "🟢 LIVE" : "🔴 OFFLINE",
        route: {
          name: bus.route?.routeName || "No Route",
          totalStops: bus.route?.stops?.length || 0,
          currentIndex: bus.currentStopIndex
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ DRIVER: Update live location (Phone GPS)
app.put('/bus/location/:busNumber', async (req, res) => {
  try {
    const { latitude, longitude, driverName } = req.body;
    
    if (latitude == null || longitude == null) {
      return res.status(400).json({ 
        success: false,
        error: "Latitude and longitude required" 
      });
    }

    const bus = await Bus.findOne({ busNumber: req.params.busNumber });
    if (!bus) {
      return res.status(404).json({ 
        success: false,
        error: "Bus not found" 
      });
    }

    // Update bus location
    bus.location.latitude = latitude;
    bus.location.longitude = longitude;
    bus.location.lastUpdated = new Date();
    if (driverName) bus.driverName = driverName;
    
    await bus.save();

    // Emit real-time update to all passengers
    io.emit(`bus-${req.params.busNumber}`, {
      type: 'location_update',
      busNumber: bus.busNumber,
      location: {
        latitude,
        longitude,
        lastUpdated: new Date()
      }
    });

    res.json({
      success: true,
      message: "Location updated successfully",
      location: {
        latitude,
        longitude,
        lastUpdated: new Date()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ DRIVER: Update current stop
app.put('/bus/stop/:busNumber', async (req, res) => {
  try {
    const { stopIndex } = req.body;
    
    if (stopIndex == null || stopIndex < 0) {
      return res.status(400).json({ 
        success: false,
        error: "Valid stop index required" 
      });
    }

    const bus = await Bus.findOne({ busNumber: req.params.busNumber })
      .populate('route');
    
    if (!bus) {
      return res.status(404).json({ 
        success: false,
        error: "Bus not found" 
      });
    }

    bus.currentStopIndex = stopIndex;
    await bus.save();

    const currentStop = bus.route ? bus.route.stops[stopIndex] : "Unknown";
    const nextStop = bus.route ? bus.route.stops[stopIndex + 1] : "Unknown";

    // Emit real-time stop update
    io.emit(`bus-${req.params.busNumber}`, {
      type: 'stop_update',
      busNumber: bus.busNumber,
      currentStop,
      nextStop,
      stopIndex
    });

    res.json({
      success: true,
      message: "Bus stop updated",
      currentStop,
      nextStop,
      stopIndex
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- SOCKET.IO FOR REAL-TIME UPDATES -----------------
io.on('connection', (socket) => {
  console.log('📱 User connected:', socket.id);

  // Join bus room for real-time updates
  socket.on('join-bus', (busNumber) => {
    socket.join(`bus-${busNumber}`);
    console.log(`🚌 User joined bus ${busNumber} room`);
  });

  // Leave bus room
  socket.on('leave-bus', (busNumber) => {
    socket.leave(`bus-${busNumber}`);
    console.log(`🚌 User left bus ${busNumber} room`);
  });

  socket.on('disconnect', () => {
    console.log('📱 User disconnected:', socket.id);
  });
});

// ----------------- START SERVER -----------------
server.listen(PORT, () => {
  console.log(`🚌 Live Bus Tracker Backend Running on port ${PORT}`);
  console.log(`📍 Track Bus: http://localhost:${PORT}/bus/track/UP15`);
  console.log(`📱 Live Updates: Socket.IO connected`);
  console.log(`🔗 All Buses: http://localhost:${PORT}/buses`);
});
