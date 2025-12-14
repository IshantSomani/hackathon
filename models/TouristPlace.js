const mongoose = require("mongoose");

const TouristPlaceSchema = new mongoose.Schema({
  state: { type: String, required: true },
  city: { type: String, required: true },
  name: { type: String, required: true },

  crowdCount: { type: Number, default: 0 },

  footfallHistory: [
    {
      time: { type: Date, default: Date.now },
      visitors: { type: Number, default: 0 },
    },
  ],
});

module.exports = mongoose.model("TouristPlace", TouristPlaceSchema);
