const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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

// Signup & Login
app.post('/signup', async (req, res) => { /* tera signup code */ });
app.post('/login', async (req, res) => { /* tera login code */ });

// Vehicle routes
app.get('/vehicles', async (req,res)=>{ /* tera get vehicle code */ });
app.post('/vehicles', authenticateToken, async (req,res)=>{ /* tera add vehicle code */ });
app.put('/vehicles/:id/location', authenticateToken, async (req,res)=>{ /* tera update location code */ });

// Profile
app.get('/profile', authenticateToken, async (req,res)=>{ /* tera get profile code */ });

// ---------------- Bus Routes ----------------
// 1️⃣ Import bus.js
const busRoutes = require("./routes/bus");

// 2️⃣ Use bus routes
app.use("/bus", busRoutes);

// 404 & Error
app.use('*', (req,res) => res.status(404).json({ status:'error', message:'Route not found' }));
app.use((err, req,res,next) => {
  console.error(err.stack);
  res.status(500).json({ status:'error', message:'Something went wrong!' });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SwiftRide server running on port ${PORT}`);
  console.log(`API Base URL: http://localhost:${PORT}`);
});

module.exports = app;
