const mongoose = require("mongoose");

const TelecomFootfallAggregateSchema = new mongoose.Schema(
  {
    time_window: {
      start: Date,
      end: Date,
      window_minutes: Number,
    },

    location: {
      state: String,
      district: String,
      city: String,
      tourist_place: String,
      location_id: String,
    },

    footfall: {
      total_devices: Number,
      domestic_devices: Number,
      international_devices: Number,
    },

    international_breakdown: {
      type: Map,
      of: Number,
    },

    network_distribution: {
      type: Map,
      of: Number,
    },

    confidence_score: Number,
    data_source: String,
    ingested_at: Date,
  },
  {
    collection: "telecomfootfallaggregates",
  }
);

module.exports = mongoose.model(
  "TelecomFootfallAggregate",
  TelecomFootfallAggregateSchema
);
