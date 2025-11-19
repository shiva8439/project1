// models/Route.js
const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  routeName: { type: String, required: true },
  routeNumber: { type: String, required: true, unique: true },
  stops: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Stop' }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Route', routeSchema);