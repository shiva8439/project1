const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

app.options('*', cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB connected successfully');
}).catch((err) => {
  console.log('MongoDB connection error:', err.message);
  console.log('Starting server without MongoDB...');
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

// Middleware to verify token
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

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'SwiftRide API is running!' });
});

// Signup
app.post('/signup', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({
        status: 'error',
        message: 'Email, password and role are required'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User already exists with this email'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      email,
      password: hashedPassword,
      role
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

// Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
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

// Get vehicles (ONLY ONE ROUTE NOW ✔)
app.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ isAvailable: true })
      .populate('driver', 'email')
      .select('name type number driver currentLocation');

    res.json(vehicles.map(vehicle => ({
      _id: vehicle._id,
      name: vehicle.name,
      type: vehicle.type,
      number: vehicle.number,
      driverName: vehicle.driver ? vehicle.driver.email : 'Unknown',
      currentLocation: vehicle.currentLocation,
      rating: 5.0,
      eta: '5 min'
    })));

  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Add vehicle
app.post('/vehicles', authenticateToken, async (req, res) => {
  try {
    const { name, type, number, currentLocation } = req.body;

    if (req.user.role !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Only drivers can add vehicles'
      });
    }

    if (!name || !type || !number) {
      return res.status(400).json({
        status: 'error',
        message: 'Name, type, and number are required'
      });
    }

    const exists = await Vehicle.findOne({ number });
    if (exists) {
      return res.status(400).json({
        status: 'error',
        message: 'Vehicle with this number already exists'
      });
    }

    const vehicle = new Vehicle({
      name,
      type,
      number,
      driver: req.user.userId,
      currentLocation
    });

    await vehicle.save();

    res.status(201).json({
      status: 'success',
      message: 'Vehicle added successfully',
      vehicle: {
        id: vehicle._id,
        name: vehicle.name,
        type: vehicle.type,
        number: vehicle.number
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

    if (lat == null || lng == null) {
      return res.status(400).json({
        status: 'error',
        message: 'Latitude and longitude are required'
      });
    }

    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: req.params.id, driver: req.user.userId },
      { currentLocation: { lat, lng } },
      { new: true }
    );

    if (!vehicle) {
      return res.status(404).json({
        status: 'error',
        message: 'Vehicle not found or unauthorized'
      });
    }

    res.json({
      status: 'success',
      message: 'Location updated',
      vehicle
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Profile
app.get('/profile', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.userId).select('-password');
  res.json({ status: 'success', user });
});

// ERROR HANDLER (correct position)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: 'error', message: 'Something went wrong!' });
});

// 404 MUST BE LAST ✔
app.use('*', (req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`SwiftRide server is running on port ${PORT}`);
});

module.exports = app;
