const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const saltRounds = 10;
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
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bus-tracker')
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB Error:", err));

// ----------------- OPTIMIZED MODELS -----------------

// Stop Schema (embedded in routes)
const stopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  stopOrder: { type: Number, required: true },
  estimatedTime: { type: Number } // minutes from start
});

// Route Schema (optimized with embedded stops and polyline)
const routeSchema = new mongoose.Schema({
  routeName: { type: String, required: true },
  routeNumber: { type: String, unique: true, required: true },
  description: String,
  stops: [stopSchema],
  polyline: [{
    lat: Number,
    lng: Number
  }],
  totalDistance: Number, // in km
  estimatedDuration: Number, // in minutes
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Bus Schema (optimized with proper indexing)
const busSchema = new mongoose.Schema({
  busNumber: { type: String, unique: true, required: true, index: true },
  driverName: { type: String, required: true },
  driverPhone: String,
  driverEmail: String,
  route: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  currentStopIndex: { type: Number, default: 0 },
  nextStopIndex: { type: Number, default: 1 },
  location: {
    latitude: { type: Number, default: 0, index: '2dsphere' },
    longitude: { type: Number, default: 0, index: '2dsphere' },
    lastUpdated: { type: Date, default: Date.now },
    accuracy: Number,
    speed: Number, // km/h
    heading: Number // degrees
  },
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'maintenance', 'break'], 
    default: 'inactive' 
  },
  isActive: { type: Boolean, default: true },
  capacity: { type: Number, default: 50 },
  currentPassengers: { type: Number, default: 0 },
  lastTripStarted: Date,
  lastTripEnded: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound indexes for performance
busSchema.index({ busNumber: 1, isActive: 1 });
busSchema.index({ route: 1, isActive: 1 });
busSchema.index({ 'location.lastUpdated': -1 });

const User = mongoose.model('User', new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['driver', 'admin', 'passenger'], default: 'driver' },
  isActive: { type: Boolean, default: true }
}));

const Route = mongoose.model('Route', routeSchema);
const Bus = mongoose.model('Bus', busSchema);

// ----------------- HELPER FUNCTIONS -----------------

// Check if bus is live (updated in last 30 seconds for real-time tracking)
function isBusLive(lastUpdated) {
  if (!lastUpdated) return false;
  const now = new Date();
  const lastUpdate = new Date(lastUpdated);
  const diffSeconds = (now - lastUpdate) / 1000;
  return diffSeconds <= 30; // Live if updated within last 30 seconds
}

// Calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Find nearest stop to current location
function findNearestStop(lat, lng, stops) {
  let nearestStop = null;
  let minDistance = Infinity;
  
  stops.forEach((stop, index) => {
    const distance = calculateDistance(lat, lng, stop.lat, stop.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearestStop = { ...stop.toObject(), index, distance };
    }
  });
  
  return nearestStop;
}

// ----------------- API ROUTES -----------------

// ✅ GET BUS BY NUMBER WITH ROUTE
app.get('/api/bus/:number', async (req, res) => {
  try {
    const { number } = req.params;
    
    const bus = await Bus.findOne({ 
      busNumber: number.toUpperCase(), 
      isActive: true 
    }).populate('route');
    
    if (!bus) {
      return res.status(404).json({ 
        success: false, 
        error: "Bus not found or inactive" 
      });
    }
    
    const live = isBusLive(bus.location.lastUpdated);
    const nearestStop = bus.route.stops.length > 0 ? 
      findNearestStop(bus.location.latitude, bus.location.longitude, bus.route.stops) : null;
    
    res.json({
      success: true,
      bus: {
        _id: bus._id,
        busNumber: bus.busNumber,
        driverName: bus.driverName,
        route: {
          _id: bus.route._id,
          routeName: bus.route.routeName,
          routeNumber: bus.route.routeNumber,
          stops: bus.route.stops,
          polyline: bus.route.polyline
        },
        location: {
          latitude: bus.location.latitude,
          longitude: bus.location.longitude,
          lastUpdated: bus.location.lastUpdated,
          speed: bus.location.speed,
          heading: bus.location.heading
        },
        currentStopIndex: bus.currentStopIndex,
        nextStopIndex: bus.nextStopIndex,
        status: bus.status,
        isLive: live,
        currentPassengers: bus.currentPassengers,
        capacity: bus.capacity,
        nearestStop: nearestStop
      }
    });
  } catch (err) {
    console.error(`❌ GET BUS ERROR: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ GET ROUTE BY BUS NUMBER
app.get('/api/route/:busNumber', async (req, res) => {
  try {
    const { busNumber } = req.params;
    
    const bus = await Bus.findOne({ 
      busNumber: busNumber.toUpperCase(), 
      isActive: true 
    }).populate('route');
    
    if (!bus || !bus.route) {
      return res.status(404).json({ 
        success: false, 
        error: "Bus not found or no route assigned" 
      });
    }
    
    res.json({
      success: true,
      route: {
        _id: bus.route._id,
        routeName: bus.route.routeName,
        routeNumber: bus.route.routeNumber,
        description: bus.route.description,
        stops: bus.route.stops,
        polyline: bus.route.polyline,
        totalDistance: bus.route.totalDistance,
        estimatedDuration: bus.route.estimatedDuration
      },
      busInfo: {
        busNumber: bus.busNumber,
        driverName: bus.driverName,
        currentStopIndex: bus.currentStopIndex,
        nextStopIndex: bus.nextStopIndex,
        status: bus.status
      }
    });
  } catch (err) {
    console.error(`❌ GET ROUTE ERROR: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ GET ALL ROUTES WITH BUSES
app.get('/api/routes', async (req, res) => {
  try {
    const routes = await Route.find({ isActive: true })
      .populate({
        path: 'buses',
        match: { isActive: true },
        select: 'busNumber driverName location status currentStopIndex'
      });
    
    const routesWithBuses = routes.map(route => {
      const routeData = route.toObject();
      const liveBuses = routeData.buses?.filter(bus => 
        isBusLive(bus.location?.lastUpdated)
      ) || [];
      
      return {
        ...routeData,
        totalBuses: routeData.buses?.length || 0,
        liveBuses: liveBuses.length,
        buses: liveBuses.map(bus => ({
          _id: bus._id,
          busNumber: bus.busNumber,
          driverName: bus.driverName,
          location: bus.location,
          status: bus.status,
          currentStopIndex: bus.currentStopIndex,
          isLive: isBusLive(bus.location?.lastUpdated)
        }))
      };
    });
    
    res.json({
      success: true,
      routes: routesWithBuses
    });
  } catch (err) {
    console.error(`❌ GET ROUTES ERROR: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ GET BUSES FOR SPECIFIC ROUTE
app.get('/api/routes/:routeId/buses', async (req, res) => {
  try {
    const { routeId } = req.params;
    
    const buses = await Bus.find({ 
      route: routeId, 
      isActive: true 
    }).populate('route', 'routeName routeNumber stops polyline');
    
    const busesWithStatus = buses.map(bus => {
      const live = isBusLive(bus.location.lastUpdated);
      const nearestStop = bus.route.stops.length > 0 ? 
        findNearestStop(bus.location.latitude, bus.location.longitude, bus.route.stops) : null;
      
      return {
        _id: bus._id,
        busNumber: bus.busNumber,
        driverName: bus.driverName,
        location: bus.location,
        isLive: live,
        status: bus.status,
        currentStopIndex: bus.currentStopIndex,
        nextStopIndex: bus.nextStopIndex,
        nearestStop: nearestStop,
        route: {
          _id: bus.route._id,
          routeName: bus.route.routeName,
          routeNumber: bus.route.routeNumber
        }
      };
    });
    
    res.json({
      success: true,
      buses: busesWithStatus,
      routeId: routeId
    });
  } catch (err) {
    console.error(`❌ GET ROUTE BUSES ERROR: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ UPDATE BUS LOCATION (DRIVER APP)
app.put('/api/bus/:busNumber/location', async (req, res) => {
  try {
    const { busNumber } = req.params;
    const { latitude, longitude, speed, heading, accuracy } = req.body;
    
    if (latitude == null || longitude == null) {
      return res.status(400).json({ 
        success: false, 
        error: "Latitude and longitude required" 
      });
    }
    
    const bus = await Bus.findOne({ 
      busNumber: busNumber.toUpperCase(), 
      isActive: true 
    }).populate('route');
    
    if (!bus) {
      return res.status(404).json({ 
        success: false, 
        error: "Bus not found or inactive" 
      });
    }
    
    // Update location
    bus.location.latitude = latitude;
    bus.location.longitude = longitude;
    bus.location.lastUpdated = new Date();
    bus.location.speed = speed || 0;
    bus.location.heading = heading || 0;
    bus.location.accuracy = accuracy || 0;
    bus.updatedAt = new Date();
    
    // Find nearest stop and update indices
    if (bus.route && bus.route.stops.length > 0) {
      const nearestStop = findNearestStop(latitude, longitude, bus.route.stops);
      if (nearestStop && nearestStop.distance < 0.1) { // Within 100 meters
        bus.currentStopIndex = nearestStop.index;
        bus.nextStopIndex = Math.min(nearestStop.index + 1, bus.route.stops.length - 1);
      }
    }
    
    await bus.save();
    
    // Emit real-time update to all clients
    const locationData = {
      busNumber: bus.busNumber,
      busId: bus._id,
      latitude: latitude,
      longitude: longitude,
      speed: speed || 0,
      heading: heading || 0,
      lastUpdated: bus.location.lastUpdated,
      currentStopIndex: bus.currentStopIndex,
      nextStopIndex: bus.nextStopIndex,
      routeName: bus.route?.routeName,
      routeNumber: bus.route?.routeNumber
    };
    
    // Emit to bus-specific room and general channel
    io.emit(`bus-${busNumber}`, locationData);
    io.emit('locationUpdate', locationData);
    
    console.log(`📍 Location Updated: ${busNumber} -> ${latitude}, ${longitude}`);
    
    res.json({
      success: true,
      message: "Location updated successfully",
      location: locationData
    });
  } catch (err) {
    console.error(`❌ LOCATION UPDATE ERROR: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ CREATE ROUTE WITH POLYLINE
app.post('/api/routes', async (req, res) => {
  try {
    const { routeName, routeNumber, description, stops, polyline } = req.body;
    
    if (!routeName || !routeNumber || !stops || stops.length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: "Route name, number, and at least 2 stops required" 
      });
    }
    
    // Calculate total distance
    let totalDistance = 0;
    for (let i = 1; i < stops.length; i++) {
      totalDistance += calculateDistance(
        stops[i-1].lat, stops[i-1].lng,
        stops[i].lat, stops[i].lng
      );
    }
    
    const route = await Route.create({
      routeName,
      routeNumber,
      description,
      stops: stops.map((stop, index) => ({
        ...stop,
        stopOrder: index,
        estimatedTime: stop.estimatedTime || (index * 5) // Default 5 minutes per stop
      })),
      polyline: polyline || stops,
      totalDistance: Math.round(totalDistance * 100) / 100,
      estimatedDuration: Math.round(totalDistance * 2) // Rough estimate: 2 min per km
    });
    
    res.status(201).json({
      success: true,
      message: "Route created successfully",
      route
    });
  } catch (err) {
    console.error(`❌ CREATE ROUTE ERROR: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ ASSIGN BUS TO ROUTE
app.post('/api/buses/assign', async (req, res) => {
  try {
    const { busNumber, routeId, driverName } = req.body;
    
    if (!busNumber || !routeId || !driverName) {
      return res.status(400).json({ 
        success: false, 
        error: "Bus number, route ID, and driver name required" 
      });
    }
    
    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({ 
        success: false, 
        error: "Route not found" 
      });
    }
    
    const bus = await Bus.findOneAndUpdate(
      { busNumber: busNumber.toUpperCase() },
      { 
        route: routeId,
        driverName,
        status: 'active',
        isActive: true,
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    ).populate('route');
    
    res.json({
      success: true,
      message: "Bus assigned to route successfully",
      bus
    });
  } catch (err) {
    console.error(`❌ ASSIGN BUS ERROR: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- SOCKET.IO REAL-TIME UPDATES -----------------

io.on('connection', (socket) => {
  console.log(`📱 Client connected: ${socket.id}`);
  
  // Join bus room for specific bus tracking
  socket.on('join-bus', (busNumber) => {
    socket.join(`bus-${busNumber}`);
    console.log(`🚌 Client joined bus ${busNumber} room`);
  });
  
  // Leave bus room
  socket.on('leave-bus', (busNumber) => {
    socket.leave(`bus-${busNumber}`);
    console.log(`🚌 Client left bus ${busNumber} room`);
  });
  
  // Join route room for route-wide tracking
  socket.on('join-route', (routeId) => {
    socket.join(`route-${routeId}`);
    console.log(`🛣️ Client joined route ${routeId} room`);
  });
  
  socket.on('disconnect', () => {
    console.log(`📱 Client disconnected: ${socket.id}`);
  });
});

// ----------------- START SERVER -----------------
server.listen(PORT, () => {
  console.log(`🚀 Optimized Bus Tracker Backend Running on port ${PORT}`);
  console.log(`📍 API Endpoints:`);
  console.log(`   GET /api/bus/:number - Get bus with route`);
  console.log(`   GET /api/route/:busNumber - Get route by bus`);
  console.log(`   GET /api/routes - Get all routes with buses`);
  console.log(`   GET /api/routes/:routeId/buses - Get buses for route`);
  console.log(`   PUT /api/bus/:busNumber/location - Update bus location`);
  console.log(`   POST /api/routes - Create route`);
  console.log(`   POST /api/buses/assign - Assign bus to route`);
  console.log(`📡 Socket.IO real-time updates enabled`);
});
