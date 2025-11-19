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

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ status: 'error', message: 'Access token required' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ status: 'error', message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ------------------ ROUTES ------------------

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'SwiftRide API is running!' });
});

// Signup
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) return res.status(400).json({ status:'error', message:'Email, password, role required' });
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ status:'error', message:'User already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword, role });
    await newUser.save();
    res.status(201).json({ status:'success', message:'User created', user:{ id:newUser._id, email:newUser.email, role:newUser.role } });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ status:'error', message:'Email & password required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ status:'error', message:'Invalid email or password' });
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) return res.status(401).json({ status:'error', message:'Invalid email or password' });
    const token = jwt.sign({ userId:user._id, email:user.email, role:user.role }, JWT_SECRET, { expiresIn:'24h' });
    res.json({ status:'success', message:'Login successful', token, user:{ id:user._id, email:user.email, role:user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

// Get all vehicles
app.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ isAvailable:true })
      .populate('driver','email')
      .select('name type number driver currentLocation');
    res.json(vehicles.map(v => ({
      _id:v._id,
      name:v.name,
      type:v.type,
      number:v.number,
      driverName:v.driver ? v.driver.email : 'Unknown',
      currentLocation:v.currentLocation,
      rating:5.0,
      eta:'5 min'
    })));
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

// Get single vehicle by ID (for PassengerPanel)
app.get('/vehicles/:id', async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id)
      .select('name number type currentLocation');
    if (!vehicle) return res.status(404).json({ status:'error', message:'Vehicle not found' });
    res.json({
      _id: vehicle._id,
      name: vehicle.name,
      type: vehicle.type,
      number: vehicle.number,
      currentLocation: vehicle.currentLocation
    });
  } catch (error) {
    console.error('Get single vehicle error:', error);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

// Add vehicle (drivers only)
app.post('/vehicles', authenticateToken, async (req, res) => {
  try {
    const { name, type, number, currentLocation } = req.body;
    if (req.user.role !== 'driver') return res.status(403).json({ status:'error', message:'Only drivers can add vehicles' });
    if (!name || !type || !number) return res.status(400).json({ status:'error', message:'Name, type, number required' });
    const existingVehicle = await Vehicle.findOne({ number });
    if (existingVehicle) return res.status(400).json({ status:'error', message:'Vehicle with this number already exists' });
    const newVehicle = new Vehicle({ name, type, number, driver:req.user.userId, currentLocation });
    await newVehicle.save();
    res.status(201).json({ status:'success', message:'Vehicle added', vehicle:{ id:newVehicle._id, name:newVehicle.name, type:newVehicle.type, number:newVehicle.number } });
  } catch (error) {
    console.error('Add vehicle error:', error);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

// Update vehicle location
app.put('/vehicles/:id/location', authenticateToken, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const vehicleId = req.params.id;
    if (!lat || !lng) return res.status(400).json({ status:'error', message:'Latitude & longitude required' });
    const vehicle = await Vehicle.findOneAndUpdate(
      { _id:vehicleId, driver:req.user.userId },
      { currentLocation:{lat,lng} },
      { new:true }
    );
    if (!vehicle) return res.status(404).json({ status:'error', message:'Vehicle not found or unauthorized' });
    res.json({ status:'success', message:'Location updated', vehicle:{ id:vehicle._id, name:vehicle.name, location:vehicle.currentLocation } });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

// Get user profile
app.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ status:'error', message:'User not found' });
    res.json({ status:'success', user:{ id:user._id, email:user.email, role:user.role, createdAt:user.createdAt } });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status:'error', message:'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ status:'error', message:'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`SwiftRide server is running on port ${PORT}`);
  console.log(`API Base URL: http://localhost:${PORT}`);
});

module.exports = app;

