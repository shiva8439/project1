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

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://Shiva:neemkapatta1234@cluster0.9dbq9a1.mongodb.net')
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
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

// ----------------- Auth Routes -----------------
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password, name, role = 'passenger' } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password: hashedPassword,
      name,
      role
    });

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- Bus Routes -----------------
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

app.put('/api/buses/:busId/location', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Only drivers allowed" });

    const { latitude, longitude } = req.body;
    if (latitude == null || longitude == null) return res.status(400).json({ success: false, error: "latitude & longitude required" });

    const busId = req.params.busId;

    const bus = await Bus.findOne({ _id: busId, driverId: req.user.userId });
    if (!bus) return res.status(404).json({ success: false, error: "Bus not found or not owned by you" });

    bus.location.latitude = latitude;
    bus.location.longitude = longitude;
    bus.location.updatedAt = new Date();
    await bus.save();

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

    res.json({ success: true, message: "Location updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- Bus Stops Routes -----------------
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

app.post('/api/routes', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Only drivers allowed" });

    const { routeName, routeNumber, stopIds } = req.body;
    if (!routeName || !routeNumber) {
      return res.status(400).json({ success: false, error: "Route name & number required" });
    }

    const existingRoute = await Route.findOne({ routeNumber });
    if (existingRoute) return res.status(400).json({ success: false, error: "Route number already exists" });

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

// ----------------- Simple Tracking Endpoints (Like Where is my Train) -----------------
app.get('/api/passenger/simple-tracking', async (req, res) => {
  try {
    const { routeNumber } = req.query;
    
    let route;
    if (routeNumber) {
      route = await Route.findOne({ routeNumber }).populate('stops');
    } else {
      route = await Route.findOne().populate('stops');
    }
    
    if (!route) return res.status(404).json({ success: false, error: "No route found" });

    const buses = await Bus.find({ route: route._id, isActive: true })
      .populate('driverId', 'name')
      .populate('stops');

    const formattedBuses = buses.map(bus => {
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

      return {
        busNumber: bus.busNumber,
        driverName: bus.driverId?.name || 'N/A',
        status: currentStopIndex === -1 ? 'Not Started' : 
                currentStopIndex >= allStops.length ? 'Completed' : 'Running',
        currentStop: currentStop ? currentStop.name : 'N/A',
        lastStopReached: bus.lastStopReached ? 
          allStops.find(s => s._id.toString() === bus.lastStopReached.toString())?.name : 'None',
        upcomingStops: upcomingStops.map(stop => stop.name),
        completedStops: completedStops.map(stop => stop.name),
        progress: {
          totalStops: allStops.length,
          completedStops: completedStops.length,
          nextStop: upcomingStops.length > 0 ? upcomingStops[0].name : 'End of Route'
        }
      };
    });

    res.json({
      success: true,
      route: {
        routeNumber: route.routeNumber,
        routeName: route.routeName,
        stops: route.stops.map(stop => stop.name)
      },
      buses: formattedBuses
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/passenger/routes-simple', async (req, res) => {
  try {
    const routes = await Route.find().select('routeNumber routeName').sort({ routeNumber: 1 });
    
    res.json({
      success: true,
      routes: routes.map(route => ({
        routeNumber: route.routeNumber,
        routeName: route.routeName
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/passenger/bus-stops/:busNumber', async (req, res) => {
  try {
    const busNumber = req.params.busNumber;
    
    const bus = await Bus.findOne({ busNumber })
      .populate('route')
      .populate('stops');
      
    if (!bus) return res.status(404).json({ success: false, error: "Bus not found" });

    const allStops = bus.stops;
    const currentStopIndex = bus.currentStopIndex;
    
    const stopsSequence = allStops.map((stop, index) => {
      let status = 'upcoming';
      if (index < currentStopIndex) {
        status = 'completed';
      } else if (index === currentStopIndex) {
        status = 'current';
      }
      
      return {
        name: stop.name,
        status: status,
        order: index + 1
      };
    });

    res.json({
      success: true,
      bus: {
        busNumber: bus.busNumber,
        routeName: bus.route?.routeName || 'N/A',
        currentStopIndex: currentStopIndex,
        totalStops: allStops.length
      },
      stops: stopsSequence
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

    const bus = await Bus.findOne({ _id: busId, driverId: req.user.userId })
      .populate('stops');
    if (!bus) return res.status(404).json({ success: false, error: "Bus not found or not owned by you" });

    if (stopIndex >= bus.stops.length) {
      return res.status(400).json({ success: false, error: "Invalid stop index" });
    }

    bus.currentStopIndex = stopIndex;
    bus.lastStopReached = bus.stops[stopIndex]._id;
    await bus.save();

    const reachedStop = bus.stops[stopIndex];

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

// DRIVER: UPDATE BUS DETAILS
app.put('/api/driver/bus/:busId/update', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Only drivers allowed" });

    const { busNumber, route, stops, isActive } = req.body;
    const busId = req.params.busId;

    const bus = await Bus.findOne({ _id: busId, driverId: req.user.userId });
    if (!bus) return res.status(404).json({ success: false, error: "Bus not found or not owned by you" });

    if (busNumber) bus.busNumber = busNumber;
    if (route) bus.route = route;
    if (stops) bus.stops = stops;
    if (isActive !== undefined) bus.isActive = isActive;

    await bus.save();

    const updatedBus = await Bus.findById(bus._id).populate('driverId', 'name email').populate('route');

    res.json({ 
      success: true, 
      message: "Bus updated successfully",
      bus: {
        _id: updatedBus._id.toString(),
        busNumber: updatedBus.busNumber,
        driver: updatedBus.driverId,
        route: updatedBus.route,
        stops: updatedBus.stops,
        isActive: updatedBus.isActive
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DRIVER: DELETE/DEACTIVATE BUS
app.delete('/api/driver/bus/:busId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ success: false, error: "Only drivers allowed" });

    const busId = req.params.busId;

    const bus = await Bus.findOne({ _id: busId, driverId: req.user.userId });
    if (!bus) return res.status(404).json({ success: false, error: "Bus not found or not owned by you" });

    bus.isActive = false;
    await bus.save();

    res.json({ 
      success: true, 
      message: "Bus deactivated successfully" 
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
