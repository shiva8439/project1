const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  routeName: String,
  routeNumber: String,
  stops: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Stop' }]
});

module.exports = mongoose.model('Route', routeSchema);