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

// ----------------- Import Models -----------------
const User = require('./User');
const Stop = require('./Stop');
const Route = require('./Route');
const Bus = require('./Bus');
const LiveLocation = require('./Livelocation');
const Ride = require('./Ride');


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

// ----------------- Bus Routes -----------------
// Passenger: Bus number se search (no auth)
app.get('/api/buses/search', async (req, res) => {
  try {
    const { number } = req.query;
    if (!number) return res.status(400).json({ success: false, error: "Bus number required" });

    const buses = await Bus.find({
      busNumber: { $regex: new RegExp(`^${number.trim()}$`, 'i') }
    }).populate('driverId', 'name email').populate('route');

    res.json({
      success: true,
      buses: buses.map(bus => ({
        _id: bus._id.toString(),
        busNumber: bus.busNumber,
        driver: bus.driverId,
        route: bus.route,
        location: bus.location,
        stops: bus.stops
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET ALL BUSES
app.get('/api/buses', async (req, res) => {
  try {
    const buses = await Bus.find().populate('driverId', 'name email').populate('route');
    res.json({
      success: true,
      buses: buses.map(bus => ({
        _id: bus._id.toString(),
        busNumber: bus.busNumber,
        driver: bus.driverId,
        route: bus.route,
        location: bus.location,
        stops: bus.stops
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET SINGLE BUS by id
app.get('/api/buses/:id', async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id).populate('driverId', 'name email').populate('route');
    if (!bus) return res.status(404).json({ success: false, error: "Bus not found" });

    res.json({
      success: true,
      bus: {
        _id: bus._id.toString(),
        busNumber: bus.busNumber,
        driver: bus.driverId,
        route: bus.route,
        location: bus.location,
        stops: bus.stops
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DRIVER: REGISTER BUS
app.post('/api/driver/register-bus', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Only drivers allowed" });

    const { busNumber, route, stops } = req.body;
    if (!busNumber || !route) return res.status(400).json({ success: false, error: "Bus number & route required" });

    const exists = await Bus.findOne({ busNumber });
    if (exists) return res.status(400).json({ success: false, error: "Bus already registered" });

    const bus = await Bus.create({
      busNumber,
      driverId: req.user.userId,
      route,
      stops: stops || [],
      location: { latitude: 0, longitude: 0 }
    });

    const populatedBus = await Bus.findById(bus._id).populate('driverId', 'name email').populate('route');

    res.json({ 
      success: true, 
      bus: {
        _id: populatedBus._id.toString(),
        busNumber: populatedBus.busNumber,
        driver: populatedBus.driverId,
        route: populatedBus.route,
        stops: populatedBus.stops
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DRIVER: GET MY BUS
app.get('/api/driver/my-bus', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Only drivers allowed" });

    const bus = await Bus.findOne({ driverId: req.user.userId }).populate('route');
    if (!bus) return res.status(404).json({ success: false, error: "No bus registered" });

    res.json({
      success: true,
      bus: {
        _id: bus._id.toString(),
        busNumber: bus.busNumber,
        route: bus.route,
        location: bus.location,
        stops: bus.stops
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DRIVER: UPDATE BUS LOCATION
app.put('/api/buses/:busId/location', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Only drivers allowed" });

    const { latitude, longitude } = req.body;
    if (latitude == null || longitude == null) return res.status(400).json({ success: false, error: "latitude & longitude required" });

    const busId = req.params.busId;

    // Ownership check
    const bus = await Bus.findOne({ _id: busId, driverId: req.user.userId });
    if (!bus) return res.status(404).json({ success: false, error: "Bus not found or not owned by you" });

    // Update location
    bus.location.latitude = latitude;
    bus.location.longitude = longitude;
    bus.location.updatedAt = new Date();
    await bus.save();

    // Save to live locations
    await LiveLocation.findOneAndUpdate(
      { busId: bus._id },
      { 
        busId: bus._id,
        busNumber: bus.busNumber,
        latitude,
        longitude,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Broadcast to passengers tracking this bus
    io.to(bus._id.toString()).emit('busLocationUpdate', {
      busId: bus._id.toString(),
      busNumber: bus.busNumber,
      latitude,
      longitude,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: "Location updated and broadcasted" });
  } catch (err) {
    console.error("Location update error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- Bus Stops Routes -----------------
// GET ALL STOPS
app.get('/api/stops', async (req, res) => {
  try {
    const stops = await Stop.find().sort({ createdAt: 1 });
    res.json({
      success: true,
      stops: stops.map(stop => ({
        _id: stop._id.toString(),
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        createdAt: stop.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ADD NEW STOP (Driver only)
app.post('/api/stops', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Only drivers allowed" });

    const { name, lat, lng } = req.body;
    if (!name || lat == null || lng == null) {
      return res.status(400).json({ success: false, error: "Name, lat & lng required" });
    }

    const stop = await Stop.create({
      name: name.trim(),
      lat: parseFloat(lat),
      lng: parseFloat(lng)
    });

    res.status(201).json({
      success: true,
      stop: {
        _id: stop._id.toString(),
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        createdAt: stop.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- Routes Management -----------------
// GET ALL ROUTES WITH STOPS
app.get('/api/routes', async (req, res) => {
  try {
    const routes = await Route.find().populate('stops').sort({ createdAt: 1 });
    res.json({
      success: true,
      routes: routes.map(route => ({
        _id: route._id.toString(),
        routeName: route.routeName,
        routeNumber: route.routeNumber,
        stops: route.stops.map(stop => ({
          _id: stop._id.toString(),
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng
        }))
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ADD NEW ROUTE WITH STOPS (Driver only)
app.post('/api/routes', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Only drivers allowed" });

    const { routeName, routeNumber, stopIds } = req.body;
    if (!routeName || !routeNumber) {
      return res.status(400).json({ success: false, error: "Route name & number required" });
    }

    // Check if route number already exists
    const existingRoute = await Route.findOne({ routeNumber });
    if (existingRoute) return res.status(400).json({ success: false, error: "Route number already exists" });

    // Validate stop IDs if provided
    let stops = [];
    if (stopIds && Array.isArray(stopIds)) {
      const validStops = await Stop.find({ _id: { $in: stopIds } });
      if (validStops.length !== stopIds.length) {
        return res.status(400).json({ success: false, error: "Some stop IDs are invalid" });
      }
      stops = validStops.map(stop => stop._id);
    }

    const route = await Route.create({
      routeName: routeName.trim(),
      routeNumber: routeNumber.trim(),
      stops
    });

    const populatedRoute = await Route.findById(route._id).populate('stops');

    res.status(201).json({
      success: true,
      route: {
        _id: populatedRoute._id.toString(),
        routeName: populatedRoute.routeName,
        routeNumber: populatedRoute.routeNumber,
        stops: populatedRoute.stops.map(stop => ({
          _id: stop._id.toString(),
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET ROUTE BY ID
app.get('/api/routes/:id', async (req, res) => {
  try {
    const route = await Route.findById(req.params.id).populate('stops');
    if (!route) return res.status(404).json({ success: false, error: "Route not found" });

    res.json({
      success: true,
      route: {
        _id: route._id.toString(),
        routeName: route.routeName,
        routeNumber: route.routeNumber,
        stops: route.stops.map(stop => ({
          _id: stop._id.toString(),
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PASSENGER: TRACK BUS LOCATION
app.get('/api/buses/:busId/live-location', async (req, res) => {
  try {
    const busId = req.params.busId;
    
    // Get bus details
    const bus = await Bus.findById(busId).populate('route').populate('driverId', 'name');
    if (!bus) return res.status(404).json({ success: false, error: "Bus not found" });

    // Get latest location
    const liveLocation = await LiveLocation.findOne({ busId }).sort({ updatedAt: -1 });

    res.json({
      success: true,
      bus: {
        _id: bus._id.toString(),
        busNumber: bus.busNumber,
        driver: bus.driverId,
        route: bus.route,
        stops: bus.stops
      },
      location: liveLocation || {
        busId: bus._id,
        busNumber: bus.busNumber,
        latitude: bus.location.latitude,
        longitude: bus.location.longitude,
        updatedAt: bus.location.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PASSENGER: GET ALL BUSES ON A ROUTE
app.get('/api/routes/:routeId/buses', async (req, res) => {
  try {
    const routeId = req.params.routeId;
    
    const buses = await Bus.find({ route: routeId })
      .populate('driverId', 'name email')
      .populate('route');

    res.json({
      success: true,
      buses: buses.map(bus => ({
        _id: bus._id.toString(),
        busNumber: bus.busNumber,
        driver: bus.driverId,
        route: bus.route,
        location: bus.location,
        stops: bus.stops
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PASSENGER: GET ALL ROUTES WITH BUSES AND STOPS
app.get('/api/passenger/routes', async (req, res) => {
  try {
    const routes = await Route.find().populate('stops').populate({
      path: 'buses',
      model: 'Bus',
      populate: {
        path: 'driverId',
        select: 'name email'
      }
    });

    res.json({
      success: true,
      routes: routes.map(route => ({
        _id: route._id.toString(),
        routeName: route.routeName,
        routeNumber: route.routeNumber,
        stops: route.stops.map(stop => ({
          _id: stop._id.toString(),
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng
        })),
        buses: route.buses ? route.buses.map(bus => ({
          _id: bus._id.toString(),
          busNumber: bus.busNumber,
          driver: bus.driverId,
          currentStopIndex: bus.currentStopIndex,
          isActive: bus.isActive,
          lastStopReached: bus.lastStopReached
        })) : []
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PASSENGER: GET BUS DETAILED TRACKING WITH CURRENT AND UPCOMING STOPS
app.get('/api/passenger/bus/:busId/tracking', async (req, res) => {
  try {
    const busId = req.params.busId;
    
    const bus = await Bus.findById(busId)
      .populate('route')
      .populate('stops')
      .populate('driverId', 'name')
      .populate('lastStopReached', 'name lat lng');
      
    if (!bus) return res.status(404).json({ success: false, error: "Bus not found" });

    // Get live location
    const liveLocation = await LiveLocation.findOne({ busId }).sort({ updatedAt: -1 });

    // Calculate current and upcoming stops
    const allStops = bus.stops;
    const currentStopIndex = bus.currentStopIndex;
    
    let currentStop = null;
    let upcomingStops = [];
    let completedStops = [];
    
    if (currentStopIndex >= 0 && currentStopIndex < allStops.length) {
      currentStop = allStops[currentStopIndex];
      upcomingStops = allStops.slice(currentStopIndex + 1);
      completedStops = allStops.slice(0, currentStopIndex);
    } else if (currentStopIndex === -1) {
      upcomingStops = allStops;
    } else {
      completedStops = allStops;
    }

    res.json({
      success: true,
      bus: {
        _id: bus._id.toString(),
        busNumber: bus.busNumber,
        driver: bus.driverId,
        route: bus.route,
        isActive: bus.isActive,
        lastStopReached: bus.lastStopReached
      },
      location: liveLocation || {
        busId: bus._id,
        busNumber: bus.busNumber,
        latitude: bus.location.latitude,
        longitude: bus.location.longitude,
        updatedAt: bus.location.updatedAt
      },
      stops: {
        all: allStops.map(stop => ({
          _id: stop._id.toString(),
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng
        })),
        current: currentStop ? {
          _id: currentStop._id.toString(),
          name: currentStop.name,
          lat: currentStop.lat,
          lng: currentStop.lng
        } : null,
        upcoming: upcomingStops.map(stop => ({
          _id: stop._id.toString(),
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng
        })),
        completed: completedStops.map(stop => ({
          _id: stop._id.toString(),
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng
        }))
      },
      progress: {
        totalStops: allStops.length,
        completedStops: completedStops.length,
        currentStopIndex: currentStopIndex,
        progressPercentage: allStops.length > 0 ? (completedStops.length / allStops.length) * 100 : 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DRIVER: UPDATE BUS STOP REACHED
app.put('/api/driver/bus/:busId/reach-stop', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Only drivers allowed" });

    const { stopIndex } = req.body;
    const busId = req.params.busId;

    if (stopIndex == null || stopIndex < 0) {
      return res.status(400).json({ success: false, error: "Valid stop index required" });
    }

    // Ownership check
    const bus = await Bus.findOne({ _id: busId, driverId: req.user.userId })
      .populate('stops');
    if (!bus) return res.status(404).json({ success: false, error: "Bus not found or not owned by you" });

    if (stopIndex >= bus.stops.length) {
      return res.status(400).json({ success: false, error: "Invalid stop index" });
    }

    // Update current stop
    bus.currentStopIndex = stopIndex;
    bus.lastStopReached = bus.stops[stopIndex]._id;
    await bus.save();

    const reachedStop = bus.stops[stopIndex];

    // Broadcast to passengers
    io.to(bus._id.toString()).emit('busReachedStop', {
      busId: bus._id.toString(),
      busNumber: bus.busNumber,
      stop: {
        _id: reachedStop._id.toString(),
        name: reachedStop.name,
        lat: reachedStop.lat,
        lng: reachedStop.lng
      },
      stopIndex: stopIndex,
      timestamp: new Date().toISOString()
    });

    res.json({ 
      success: true, 
      message: "Bus stop updated",
      currentStop: {
        _id: reachedStop._id.toString(),
        name: reachedStop.name,
        lat: reachedStop.lat,
        lng: reachedStop.lng
      },
      stopIndex: stopIndex
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PASSENGER: GET BUSES BY ROUTE NUMBER
app.get('/api/passenger/route/:routeNumber/buses', async (req, res) => {
  try {
    const routeNumber = req.params.routeNumber;
    
    const route = await Route.findOne({ routeNumber }).populate('stops');
    if (!route) return res.status(404).json({ success: false, error: "Route not found" });

    const buses = await Bus.find({ route: route._id, isActive: true })
      .populate('driverId', 'name')
      .populate('lastStopReached', 'name')
      .populate('stops');

    res.json({
      success: true,
      route: {
        _id: route._id.toString(),
        routeName: route.routeName,
        routeNumber: route.routeNumber,
        stops: route.stops.map(stop => ({
          _id: stop._id.toString(),
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng
        }))
      },
      buses: buses.map(bus => {
        const allStops = bus.stops;
        const currentStopIndex = bus.currentStopIndex;
        
        let currentStop = null;
        let upcomingStops = [];
        
        if (currentStopIndex >= 0 && currentStopIndex < allStops.length) {
          currentStop = allStops[currentStopIndex];
          upcomingStops = allStops.slice(currentStopIndex + 1);
        } else if (currentStopIndex === -1) {
          upcomingStops = allStops;
        }

        return {
          _id: bus._id.toString(),
          busNumber: bus.busNumber,
          driver: bus.driverId,
          lastStopReached: bus.lastStopReached,
          currentStop: currentStop ? {
            _id: currentStop._id.toString(),
            name: currentStop.name,
            lat: currentStop.lat,
            lng: currentStop.lng
          } : null,
          upcomingStops: upcomingStops.map(stop => ({
            _id: stop._id.toString(),
            name: stop.name,
            lat: stop.lat,
            lng: stop.lng
          })),
          progress: {
            totalStops: allStops.length,
            completedStops: currentStopIndex >= 0 ? currentStopIndex : 0,
            progressPercentage: allStops.length > 0 ? ((currentStopIndex >= 0 ? currentStopIndex : 0) / allStops.length) * 100 : 0
          }
        };
      })
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

