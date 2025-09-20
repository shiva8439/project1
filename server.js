const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- CORS Setup --------------------
const corsOptions = {
  origin: (origin, callback) => {
    // allow requests from localhost (dev) and your deployed frontend
    if (!origin || origin.startsWith('http://localhost') || origin === 'https://your-frontend-domain.com') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

// Apply CORS middleware globally
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Parse JSON bodies
app.use(express.json());

// -------------------- MongoDB Connection --------------------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected successfully"))
.catch(err => {
  console.error("❌ MongoDB connection error:", err.message);
  process.exit(1);
});

// -------------------- Schemas --------------------
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

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// -------------------- Auth Middleware --------------------
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

// -------------------- Routes --------------------
// Health check
app.get('/', (req, res) => res.json({ message: 'SwiftRide API is running!' }));

// Signup
app.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ status: 'error', message: 'Email and password are required' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ status: 'error', message: 'User already exists with this email' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ status: 'success', message: 'User created successfully', user: { id: newUser._id, email: newUser.email, role: newUser.role } });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ status: 'error', message: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ status: 'error', message: 'Invalid email or password' });

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) return res.status(401).json({ status: 'error', message: 'Invalid email or password' });

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ status: 'success', message: 'Login successful', token, user: { id: user._id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// Get vehicles
app.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ isAvailable: true }).populate('driver', 'email').select('name type number currentLocation');
    res.json(vehicles.map(v => ({ name: v.name, type: v.type, number: v.number, driver: v.driver?.email || 'Unknown', location: v.currentLocation })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// Add vehicle
app.post('/vehicles', authenticateToken, async (req, res) => {
  try {
    const { name, type, number, currentLocation } = req.body;
    if (req.user.role !== 'driver') return res.status(403).json({ status: 'error', message: 'Only drivers can add vehicles' });
    if (!name || !type || !number) return res.status(400).json({ status: 'error', message: 'Name, type, and number are required' });

    const existingVehicle = await Vehicle.findOne({ number });
    if (existingVehicle) return res.status(400).json({ status: 'error', message: 'Vehicle with this number already exists' });

    const newVehicle = new Vehicle({ name, type, number, driver: req.user.userId, currentLocation });
    await newVehicle.save();

    res.status(201).json({ status: 'success', message: 'Vehicle added successfully', vehicle: { id: newVehicle._id, name: newVehicle.name, type: newVehicle.type, number: newVehicle.number } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// -------------------- Error & 404 Handling --------------------
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: 'error', message: 'Something went wrong!' });
});

app.use('*', (req, res) => res.status(404).json({ status: 'error', message: 'Route not found' }));

// -------------------- Start Server --------------------
app.listen(PORT, () => {
  console.log(`SwiftRide server is running on port ${PORT}`);
  console.log(`API Base URL: http://localhost:${PORT}`);
});

module.exports = app;
