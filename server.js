const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------- CORS Setup -------------------
// Development: Allow all localhost ports
// Production: Replace with your deployed frontend domain
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || origin.startsWith('http://localhost') || origin === 'https://your-frontend-domain.com') {
      callback(null, true); // allow
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// ------------------- MongoDB Connection -------------------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected successfully"))
.catch((err) => {
  console.error("❌ MongoDB connection error:", err.message);
  process.exit(1);
});

// ------------------- Schemas -------------------
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
  currentLocation: {
    lat: { type: Number },
    lng: { type: Number }
  }
});
const Vehicle = mongoose.model('Vehicle', vehicleSchema);

// ------------------- JWT -------------------
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
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

// ------------------- Routes -------------------
// Health check
app.get('/', (req, res) => res.json({ message: 'SwiftRide API is running!' }));

// Signup
app.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ status:'error', message:'Email and password required' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ status:'error', message:'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ status:'success', message:'User created', user: { id: newUser._id, email:newUser.email, role:newUser.role }});
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ status:'error', message:'Email and password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ status:'error', message:'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ status:'error', message:'Invalid email or password' });

    const token = jwt.sign({ userId: user._id, email: user.email, role:user.role }, JWT_SECRET, { expiresIn:'24h' });
    res.json({ status:'success', message:'Login successful', token, user:{id:user._id,email:user.email,role:user.role}});
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

// Get vehicles
app.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ isAvailable:true }).populate('driver','email');
    res.json(vehicles.map(v=>({ name:v.name, type:v.type, number:v.number, driver:v.driver?.email||'Unknown', location:v.currentLocation })));
  } catch(e) {
    console.error('Get vehicles error:', e);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

// Add vehicle
app.post('/vehicles', authenticateToken, async (req,res)=>{
  try{
    if(req.user.role!=='driver') return res.status(403).json({status:'error', message:'Only drivers can add vehicles'});
    const { name, type, number, currentLocation } = req.body;
    if(!name || !type || !number) return res.status(400).json({status:'error', message:'Name, type, number required'});

    const existing = await Vehicle.findOne({ number });
    if(existing) return res.status(400).json({status:'error', message:'Vehicle with this number exists'});

    const newVehicle = new Vehicle({ name, type, number, driver:req.user.userId, currentLocation });
    await newVehicle.save();
    res.status(201).json({status:'success', message:'Vehicle added', vehicle:{id:newVehicle._id,name:newVehicle.name,type:newVehicle.type,number:newVehicle.number}});
  } catch(e){
    console.error('Add vehicle error:',e);
    res.status(500).json({status:'error',message:'Internal server error'});
  }
});

// Update vehicle location
app.put('/vehicles/:id/location', authenticateToken, async (req,res)=>{
  try{
    const {lat,lng} = req.body;
    if(lat===undefined||lng===undefined) return res.status(400).json({status:'error',message:'Latitude and longitude required'});
    const vehicle = await Vehicle.findOneAndUpdate({_id:req.params.id, driver:req.user.userId},{currentLocation:{lat,lng}},{new:true});
    if(!vehicle) return res.status(404).json({status:'error',message:'Vehicle not found or unauthorized'});
    res.json({status:'success', message:'Location updated', vehicle:{id:vehicle._id,name:vehicle.name,location:vehicle.currentLocation}});
  } catch(e){
    console.error('Update location error:',e);
    res.status(500).json({status:'error',message:'Internal server error'});
  }
});

// Get profile
app.get('/profile', authenticateToken, async (req,res)=>{
  try{
    const user = await User.findById(req.user.userId).select('-password');
    if(!user) return res.status(404).json({status:'error', message:'User not found'});
    res.json({status:'success', user:{id:user._id,email:user.email,role:user.role,createdAt:user.createdAt}});
  } catch(e){
    console.error('Get profile error:',e);
    res.status(500).json({status:'error',message:'Internal server error'});
  }
});

// ------------------- Error Handlers -------------------
app.use((err, req, res, next)=> {
  console.error(err.stack);
  res.status(500).json({ status:'error', message:'Something went wrong!' });
});
app.use('*',(req,res)=> res.status(404).json({status:'error',message:'Route not found'}));

// ------------------- Start Server -------------------
app.listen(PORT,()=>console.log(`SwiftRide server running on port ${PORT}`));

module.exports = app;
