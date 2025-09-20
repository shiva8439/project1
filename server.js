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

// MongoDB connection


const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/swiftride';

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  console.log('Server cannot continue without MongoDB');
  process.exit(1); // Exit if connection fails
});


// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['driver', 'passenger'], default: 'passenger' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Vehicle Schema
const vehicleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  number: { type: String, required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isAvailable: { type: Boolean, default: true },
  currentLocation: {
    lat: { type: Number },
    lng: { type: Number }
  }
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ status: 'error', message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'SwiftRide API is running!' });
});

// Signup route
app.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User already exists with this email'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = new User({
      email,
      password: hashedPassword
    });

    await newUser.save();

    res.status(201).json({
      status: 'success',
      message: 'User created successfully',
      user: {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Login route
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      status: 'success',
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get vehicles route
app.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ isAvailable: true })
      .populate('driver', 'email')
      .select('name type number currentLocation');

    res.json(vehicles.map(vehicle => ({
      name: vehicle.name,
      type: vehicle.type,
      number: vehicle.number,
      driver: vehicle.driver ? vehicle.driver.email : 'Unknown',
      location: vehicle.currentLocation
    })));

  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Add vehicle route (for drivers)
app.post('/vehicles', authenticateToken, async (req, res) => {
  try {
    const { name, type, number, currentLocation } = req.body;

    // Check if user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Only drivers can add vehicles'
      });
    }

    // Validate input
    if (!name || !type || !number) {
      return res.status(400).json({
        status: 'error',
        message: 'Name, type, and number are required'
      });
    }

    // Check if vehicle number already exists
    const existingVehicle = await Vehicle.findOne({ number });
    if (existingVehicle) {
      return res.status(400).json({
        status: 'error',
        message: 'Vehicle with this number already exists'
      });
    }

    // Create new vehicle
    const newVehicle = new Vehicle({
      name,
      type,
      number,
      driver: req.user.userId,
      currentLocation
    });

    await newVehicle.save();

    res.status(201).json({
      status: 'success',
      message: 'Vehicle added successfully',
      vehicle: {
        id: newVehicle._id,
        name: newVehicle.name,
        type: newVehicle.type,
        number: newVehicle.number
      }
    });

  } catch (error) {
    console.error('Add vehicle error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Update vehicle location
app.put('/vehicles/:id/location', authenticateToken, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const vehicleId = req.params.id;

    if (!lat || !lng) {
      return res.status(400).json({
        status: 'error',
        message: 'Latitude and longitude are required'
      });
    }

    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: vehicleId, driver: req.user.userId },
      { currentLocation: { lat, lng } },
      { new: true }
    );

    if (!vehicle) {
      return res.status(404).json({
        status: 'error',
        message: 'Vehicle not found or you are not authorized'
      });
    }

    res.json({
      status: 'success',
      message: 'Location updated successfully',
      vehicle: {
        id: vehicle._id,
        name: vehicle.name,
        location: vehicle.currentLocation
      }
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get user profile
app.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.json({
      status: 'success',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong!'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`SwiftRide server is running on port ${PORT}`);
  console.log(`API Base URL: http://localhost:${PORT}`);
});

module.exports = app;

