// Route.js  (root folder mein bana de)
const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  routeName: { type: String, required: true },
  routeNumber: { type: String, required: true, unique: true },
  stops: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Stop' }]
});

module.exports = mongoose.model('Route', routeSchema);