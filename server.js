const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();

// Initialize Express
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: { origin: "*" }
});

const JWT_SECRET = process.env.JWT_SECRET || 'swiftride-secret-2025';

// =============== SOCKET AUTH ===============
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return next(new Error('Authentication error'));
    socket.user = user;
    next();
  });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.user.email);

  socket.on('joinBus', (vehicleId) => {
    socket.join(vehicleId);
    console.log(`${socket.user.email} joined bus ${vehicleId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Store io globally
app.set('io', io);

// =============== EXPRESS MIDDLEWARE ===============
app.use(cors());
app.use(express.json());

// =============== MONGO CONNECT ===============
mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/swiftride")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB Error:", err));

// =============== SCHEMAS ===============
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  name: String,
  role: { type: String, enum: ['driver', 'passenger'], default: 'passenger' }
});
const User = mongoose.model('User', userSchema);

const vehicleSchema = new mongoose.Schema({
  number: String,
  driverName: String,
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  from: String,
  to: String,
  currentLocation: { lat: Number, lng: Number },
  isActive: { type: Boolean, default: true }
});
const Vehicle = mongoose.model('Vehicle', vehicleSchema);

// =============== AUTH MIDDLEWARE ===============
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Token required" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

// =============== ROUTES ===============
app.get('/', (req, res) => {
  res.json({ message: "SwiftRide API Running!" });
});

// SIGNUP
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password, role, name } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.json({ error: "User exists" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hashed,
      role,
      name: name || email.split('@')[0]
    });

    res.json({ success: true, user });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({ success: true, token, user });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// GET ALL ACTIVE BUSES
app.get('/vehicles', async (req, res) => {
  const vehicles = await Vehicle.find({ isActive: true });
  res.json(vehicles);
});

// DRIVER UPDATE LOCATION
app.put('/vehicles/:number/location', authenticateToken, async (req, res) => {
  const { lat, lng } = req.body;

  await Vehicle.findOneAndUpdate(
    { number: req.params.number },
    { currentLocation: { lat, lng } }
  );

  const io = req.app.get('io');
  io.to(req.params.number).emit('busLocation', { lat, lng });

  res.json({ success: true });
});

// =============== START SERVER ===============
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SwiftRide Backend Running at http://localhost:${PORT}`);
});
