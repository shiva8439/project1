const express = require("express");
const router = express.Router();

// Access models and middleware from app.locals
router.use((req,res,next)=>{
  req.authenticateToken = req.app.locals.authenticateToken;
  req.Bus = req.app.locals.Bus;
  req.User = req.app.locals.User;
  next();
});

// Add Bus (driver only)
router.post("/add", req.authenticateToken, async (req,res)=>{
  try{
    if(req.user.role !== 'driver') return res.status(403).json({ status:'error', message:'Only drivers can add buses' });

    const { name, number, seats } = req.body;
    if(!name || !number || !seats) return res.status(400).json({ status:'error', message:'All fields required' });

    const existingBus = await req.Bus.findOne({ number });
    if(existingBus) return res.status(400).json({ status:'error', message:'Bus with this number exists' });

    const newBus = new req.Bus({ name, number, seats, driver:req.user.userId });
    await newBus.save();
    res.status(201).json({ status:'success', message:'Bus added', bus:newBus });
  }catch(err){
    console.error(err);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

// Get all buses
router.get("/all", async (req,res)=>{
  try{
    const buses = await req.Bus.find().populate('driver','email role');
    res.json(buses);
  }catch(err){
    console.error(err);
    res.status(500).json({ status:'error', message:'Internal server error' });
  }
});

module.exports = router;
