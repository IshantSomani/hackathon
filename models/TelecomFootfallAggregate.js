const mongoose = require("mongoose");

const TelecomFootfallAggregateSchema = new mongoose.Schema(
  {
    /* ================= TIME WINDOW ================= */
    time_window: {
      start: {
        type: Date,
        required: true,
        index: true,
      },
      end: {
        type: Date,
        required: true,
        index: true,
      },
      window_minutes: {
        type: Number,
        required: true,
      },
    },

    /* ================= LOCATION ================= */
    location: {
      state: {
        type: String,
        required: true,
        index: true,
      },
      district: {
        type: String,
        index: true,
      },
      city: {
        type: String,
        index: true,
      },
      tourist_place: {
        type: String,
        index: true,
      },
      location_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TouristPlace",
        index: true,
      },
    },

    /* ================= FOOTFALL ================= */
    footfall: {
      total_devices: {
        type: Number,
        required: true,
        min: 0,
      },
      domestic_devices: {
        type: Number,
        required: true,
        min: 0,
      },
      international_devices: {
        type: Number,
        required: true,
        min: 0,
      },
    },

    /* ================= BREAKDOWNS ================= */
    international_breakdown: {
      type: Map,
      of: Number,
      default: {},
    },

    network_distribution: {
      type: Map,
      of: Number,
      default: {},
    },

    /* ================= META ================= */
    confidence_score: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
      index: true,
    },

    data_source: {
      type: String,
      enum: ["TELCO", "SIMULATED", "THIRD_PARTY"],
      default: "TELCO",
    },

    ingested_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: "telecomfootfallaggregates",
    timestamps: true, // createdAt, updatedAt
  }
);

/* ================= COMPOUND INDEXES (CRITICAL) ================= */

// Most common analytics filter
TelecomFootfallAggregateSchema.index({
  "location.state": 1,
  "location.city": 1,
  "location.tourist_place": 1,
  "time_window.start": -1,
});

// Confidence-aware analytics
TelecomFootfallAggregateSchema.index({
  confidence_score: 1,
  "time_window.start": -1,
});

// Fast hourly / time-series queries
TelecomFootfallAggregateSchema.index({
  "time_window.start": -1,
  "time_window.end": -1,
});

// Location-based drilldowns
TelecomFootfallAggregateSchema.index({
  "location.location_id": 1,
  "time_window.start": -1,
});

module.exports = mongoose.model(
  "TelecomFootfallAggregate",
  TelecomFootfallAggregateSchema
);
