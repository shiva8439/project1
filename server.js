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
  routeNumber: { type: String, unique: true, sparse: true }, // sparse: allows null
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

// ✅ AUTHENTICATION ENDPOINTS
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Simple driver validation (in production, use proper auth)
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: "Email and password required" 
      });
    }

    // Create/find user (simplified)
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        password, // In production, hash this
        name: email.split('@')[0],
        role: 'driver'
      });
    }

    res.json({
      success: true,
      token: "simple-token-" + Date.now(), // Simple token
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/signup', async (req, res) => {
  try {
    const { email, password, role = 'driver', name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: "Email and password required" 
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: "Email already exists" 
      });
    }

    const user = await User.create({
      email,
      password,
      name: name || email.split('@')[0],
      role
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    // Simple token validation (in production, use JWT)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    // For demo, return a mock user
    res.json({
      success: true,
      user: {
        _id: "mock-user-id",
        email: "driver@example.com",
        name: "Driver",
        role: "driver"
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ DRIVER VEHICLE ENDPOINTS
app.get('/api/driver/my-vehicle', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Get first bus for demo
    const bus = await Bus.findOne().populate('route');
    
    if (!bus) {
      return res.status(404).json({ 
        success: false, 
        error: "No vehicle found" 
      });
    }

    res.json({
      success: true,
      vehicle: {
        _id: bus._id,
        number: bus.busNumber,
        driverName: bus.driverName,
        route: bus.route
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/driver/register-vehicle', async (req, res) => {
  try {
    const { number, driverName, from, to, busNumber, route } = req.body;
    
    if (!number || !driverName) {
      return res.status(400).json({ 
        success: false, 
        error: "Bus number and driver name required" 
      });
    }

    // Create route
    const routeStops = [from || "Start", to || "End"];
    const newRoute = await Route.create({
      routeName: route || `${from} - ${to}`,
      routeNumber: `ROUTE-${Date.now()}`, // Generate unique route number
      stops: routeStops
    });

    // Create bus
    const bus = await Bus.create({
      busNumber: number,
      driverName,
      route: newRoute._id,
      currentStopIndex: 0,
      isActive: true,
      location: {
        latitude: 0,
        longitude: 0,
        lastUpdated: new Date()
      }
    });

    res.status(201).json({
      success: true,
      message: "Vehicle registered successfully",
      vehicle: {
        _id: bus._id,
        number: bus.busNumber,
        driverName: bus.driverName,
        route: newRoute
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ STOPS ENDPOINTS
app.post('/api/stops', async (req, res) => {
  try {
    const { name, lat, lng } = req.body;
    
    if (!name || lat == null || lng == null) {
      return res.status(400).json({ 
        success: false, 
        error: "Name, latitude and longitude required" 
      });
    }

    const stop = await Stop.create({ name, lat, lng });

    res.status(201).json({
      success: true,
      message: "Stop created successfully",
      stop
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/stops', async (req, res) => {
  try {
    const stops = await Stop.find();
    res.json({
      success: true,
      stops
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ ROUTES ENDPOINTS
app.post('/api/routes', async (req, res) => {
  try {
    const { name, from, to, stops } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: "Route name required" 
      });
    }

    const route = await Route.create({
      routeName: name,
      stops: stops || [from, to].filter(Boolean)
    });

    res.status(201).json({
      success: true,
      message: "Route created successfully",
      route
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ VEHICLE LOCATION UPDATE (Driver app)
app.put('/vehicles/:vehicleId/location', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { lat, lng, bearing } = req.body;
    
    console.log(`🚌 LOCATION UPDATE: Vehicle ${vehicleId} -> Lat: ${lat}, Lng: ${lng}`);
    
    if (lat == null || lng == null) {
      return res.status(400).json({ 
        success: false, 
        error: "Latitude and longitude required" 
      });
    }

    const bus = await Bus.findById(vehicleId);
    if (!bus) {
      return res.status(404).json({ 
        success: false, 
        error: "Vehicle not found" 
      });
    }

    // Update location
    bus.location.latitude = lat;
    bus.location.longitude = lng;
    bus.location.lastUpdated = new Date();
    await bus.save();

    console.log(`✅ Bus ${bus.busNumber} location updated in database`);

    // Emit to passengers - Multiple channels
    io.emit('locationUpdate', {
      lat,
      lng,
      bearing: bearing || 0,
      busId: vehicleId,
      busNumber: bus.busNumber
    });

    // Also emit to bus-specific room
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

// ✅ LEGACY SUPPORT - Old Flutter API
app.get('/vehicles/search', async (req, res) => {
  try {
    const { number } = req.query;
    const bus = await Bus.findOne({ busNumber: number }).populate('route');
    
    if (!bus) {
      return res.json({ success: false, vehicles: [] });
    }

    // Check if bus has valid location (not 0,0)
    const hasValidLocation = bus.location.latitude !== 0 && bus.location.longitude !== 0;

    res.json({
      success: true,
      vehicles: [{
        _id: bus._id,
        number: bus.busNumber,
        currentLocation: {
          lat: bus.location.latitude,
          lng: bus.location.longitude
        },
        hasValidLocation: hasValidLocation,
        route: bus.route,
        driverName: bus.driverName,
        isActive: bus.isActive
      }]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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
      addBus: "POST /bus/add",
      legacySearch: "GET /vehicles/search?number=UP15"
    }
  });
});

// ✅ GET ALL BUSES (For debugging)
app.get('/debug/buses', async (req, res) => {
  try {
    const buses = await Bus.find().populate('route');
    
    res.json({
      success: true,
      totalBuses: buses.length,
      buses: buses.map(bus => ({
        busNumber: bus.busNumber,
        driverName: bus.driverName,
        location: bus.location,
        isActive: bus.isActive,
        routeName: bus.route?.routeName || "No Route"
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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

    // Legacy support for old Flutter app
    io.emit(`locationUpdate`, {
      lat: latitude,
      lng: longitude,
      busId: bus._id
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

  // Legacy support for old Flutter app
  socket.on('joinVehicle', (busId) => {
    socket.join(`bus-${busId}`);
    console.log(`🚌 User joined vehicle ${busId} room`);
  });

  // Listen for location updates from drivers
  socket.on('driver-location-update', (data) => {
    console.log('📍 Driver location update received:', data);
    
    // Broadcast to all passengers
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
