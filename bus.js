const express = require("express");
const router = express.Router();
const Bus = require("./Bus");
const Route = require("./Route");


// ✅ Passenger: bus number se location dekhe
router.get("/track/:busNumber", async (req, res) => {
  const bus = await Bus.findOne({ busNumber: req.params.busNumber })
    .populate("route");

  if (!bus) {
    return res.status(404).json({ message: "Bus not found" });
  }

  const currentStop = bus.route.stops[bus.currentStopIndex];

  res.json({
    busNumber: bus.busNumber,
    currentStop,
    nextStop: bus.route.stops[bus.currentStopIndex + 1] || "Last Stop",
    lastUpdated: bus.lastUpdated
  });
});


// ✅ Driver: bus ka stop update kare
router.put("/update-stop/:busNumber", async (req, res) => {
  const { stopIndex } = req.body;

  const bus = await Bus.findOne({ busNumber: req.params.busNumber });
  if (!bus) return res.status(404).json({ message: "Bus not found" });

  bus.currentStopIndex = stopIndex;
  bus.lastUpdated = new Date();
  await bus.save();

  res.json({ message: "Bus stop updated" });
});

module.exports = router;

