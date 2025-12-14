const mongoose = require("mongoose");

const FootfallEntrySchema = new mongoose.Schema(
  {
    time: {
      type: Date,
      required: true,
      index: true,
    },
    visitors: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const TouristPlaceSchema = new mongoose.Schema(
  {
    /* ================= LOCATION ================= */
    state: {
      type: String,
      required: true,
      index: true,
    },

    city: {
      type: String,
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      index: true,
    },

    /* ================= REAL-TIME CROWD ================= */
    crowdCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    /* ================= HISTORY (CAPPED) ================= */
    footfallHistory: {
      type: [FootfallEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

/* ================= INDEXES ================= */

// Prevent duplicate tourist places
TouristPlaceSchema.index(
  { state: 1, city: 1, name: 1 },
  { unique: true }
);

// Fast lookup for dashboards
TouristPlaceSchema.index({ state: 1, city: 1 });

// Crowd alerts
TouristPlaceSchema.index({ crowdCount: -1 });

/* ================= SAFE UPDATE METHOD ================= */
TouristPlaceSchema.methods.incrementCrowd = function (count) {
  this.crowdCount = Math.max(0, this.crowdCount + count);

  this.footfallHistory.push({
    time: new Date(),
    visitors: count,
  });

  // Keep only last 500 entries (prevents document bloat)
  if (this.footfallHistory.length > 500) {
    this.footfallHistory.shift();
  }

  return this.save();
};

module.exports = mongoose.model("TouristPlace", TouristPlaceSchema);
