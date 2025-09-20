const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path"); // for proper path resolution

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// ---------------- MongoDB Connection ----------------
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/swiftride', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => {
  console.error("❌ MongoDB connection error:", err.message);
  console.log("Starting server without MongoDB...");
});

// ---------------- Schemas ----------------
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['driver', 'passenger'], default: 'passenger' },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const vehicleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  number: { type: String, required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isAvailable: { type: Boolean, default: true },
  currentLocation: { lat: Number, lng: Number }
});
const Vehicle = mongoose.model('Vehicle', vehicleSchema);

// ---------------- JWT Middleware ----------------
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

// ---------------- Routes ----------------

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'SwiftRide API is running!' });
});

// Signup
app.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ status:'error', message:'Email and password are required' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ status:'error', message:'User already exists with this email' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ status:'success', message:'User created successfully', user: { id:newUser._id, email:newUser.email, role:newUser.role } });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ status:'error', message:'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ status:'error', message:'Invalid email or password' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ status:'error', message:'Invalid email or password' });

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ status:'success', message:'Login successful', token, user: { id:user._id, email:user.email, role:user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

// Vehicle routes
app.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ isAvailable:true }).populate('driver', 'email');
    res.json(vehicles.map(v => ({ name:v.name, type:v.type, number:v.number, driver:v.driver ? v.driver.email : 'Unknown', location:v.currentLocation })));
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

app.post('/vehicles', authenticateToken, async (req, res) => {
  try {
    const { name, type, number, currentLocation } = req.body;
    if (req.user.role !== 'driver') return res.status(403).json({ status:'error', message:'Only drivers can add vehicles' });
    if (!name || !type || !number) return res.status(400).json({ status:'error', message:'Name, type, and number are required' });

    const existingVehicle = await Vehicle.findOne({ number });
    if (existingVehicle) return res.status(400).json({ status:'error', message:'Vehicle with this number already exists' });

    const newVehicle = new Vehicle({ name, type, number, driver:req.user.userId, currentLocation });
    await newVehicle.save();
    res.status(201).json({ status:'success', message:'Vehicle added successfully', vehicle:{ id:newVehicle._id, name:newVehicle.name, type:newVehicle.type, number:newVehicle.number } });
  } catch (error) {
    console.error('Add vehicle error:', error);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

app.put('/vehicles/:id/location', authenticateToken, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const vehicle = await Vehicle.findOneAndUpdate({ _id:req.params.id, driver:req.user.userId }, { currentLocation:{ lat, lng } }, { new:true });
    if (!vehicle) return res.status(404).json({ status:'error', message:'Vehicle not found or you are not authorized' });

    res.json({ status:'success', message:'Location updated', vehicle:{ id:vehicle._id, name:vehicle.name, location:vehicle.currentLocation } });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

// Profile
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

// ---------------- Bus Routes ----------------
// Import bus.js from routes, use modules from models
const busRoutes = require(path.join(__dirname, "routes", "bus")); // robust path resolution
app.use("/bus", busRoutes);

// 404 & Error middleware
app.use('*', (req,res) => res.status(404).json({ status:'error', message:'Route not found' }));
app.use((err, req,res,next) => { console.error(err.stack); res.status(500).json({ status:'error', message:'Something went wrong!' }); });

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SwiftRide server running on port ${PORT}`);
  console.log(`API Base URL: http://localhost:${PORT}`);
});

module.exports = app;
