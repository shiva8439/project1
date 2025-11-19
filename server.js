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

// ---------------- MongoDB ----------------
mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/swiftride")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB Error:", err));

// ---------------- Schemas ----------------

// USERS
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ["driver", "passenger"], default: "passenger" }
});
const User = mongoose.model("users", userSchema);

// VEHICLES
const vehicleSchema = new mongoose.Schema({
  number: { type: String, unique: true },
  driverName: String,
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: "routes" },
  isActive: { type: Boolean, default: false }
});
const Vehicle = mongoose.model("vehicles", vehicleSchema);

// LIVE LOCATIONS
const liveLocationSchema = new mongoose.Schema({
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "vehicles" },
  lat: Number,
  lng: Number,
  updatedAt: { type: Date, default: Date.now }
});
const LiveLocation = mongoose.model("livelocations", liveLocationSchema);

// ROUTES
const routeSchema = new mongoose.Schema({
  routeName: String,
  from: String,
  to: String,
  stops: [{ type: mongoose.Schema.Types.ObjectId, ref: "stops" }]
});
const Route = mongoose.model("routes", routeSchema);

// STOPS
const stopSchema = new mongoose.Schema({
  name: String,
  lat: Number,
  lng: Number
});
const Stop = mongoose.model("stops", stopSchema);

// BUS LIVES
const busLiveSchema = new mongoose.Schema({
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "vehicles" },
  status: { type: String, enum: ["inactive", "running", "completed"], default: "inactive" },
  startedAt: Date,
  endedAt: Date
});
const BusLive = mongoose.model("buslives", busLiveSchema);

// ---------------- AUTH MIDDLEWARE ----------------
const JWT_SECRET = process.env.JWT_SECRET || "swiftride-secret-2025";

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.json({ success: false, error: "Token missing" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.json({ success: false, error: "Invalid token" });

    req.user = user;
    next();
  });
};

// ---------------- ROUTES ----------------

// TEST ROOT
app.get("/", (req, res) => {
  res.json({ message: "SwiftRide Structured API Running!" });
});

// SIGNUP
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.json({ success: false, error: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);

    await User.create({ name, email, password: hashed, role });

    res.json({ success: true, message: "Account created" });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, error: "Invalid email" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ success: false, error: "Wrong password" });

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET
    );

    res.json({ success: true, token, user });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// REGISTER VEHICLE
app.post("/vehicles/register", authenticate, async (req, res) => {
  if (req.user.role !== "driver")
    return res.json({ success: false, error: "Only drivers allowed" });

  try {
    const { number, driverName } = req.body;

    const exists = await Vehicle.findOne({ number });
    if (exists) return res.json({ success: false, error: "Already Registered" });

    const vehicle = await Vehicle.create({
      number,
      driverName,
      driverId: req.user.userId
    });

    res.json({ success: true, vehicle });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// UPDATE LIVE LOCATION
app.post("/location/update", authenticate, async (req, res) => {
  if (req.user.role !== "driver")
    return res.json({ success: false, error: "Not allowed" });

  try {
    const { vehicleId, lat, lng } = req.body;

    await LiveLocation.findOneAndUpdate(
      { vehicleId },
      { lat, lng, updatedAt: new Date() },
      { upsert: true }
    );

    res.json({ success: true, message: "Location updated" });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// GET SINGLE BUS LOCATION
app.get("/location/:vehicleId", async (req, res) => {
  const data = await LiveLocation.findOne({ vehicleId: req.params.vehicleId });
  res.json(data);
});

// GET ALL ACTIVE BUSES (Passenger)
app.get("/buses/active", async (req, res) => {
  const buses = await Vehicle.find({ isActive: true });
  res.json(buses);
});

// ---------------- SERVER ----------------
app.listen(PORT, () => {
  console.log(`SwiftRide API running at http://localhost:${PORT}`);
});
