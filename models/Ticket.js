const mongoose = require("mongoose");

const TicketSchema = new mongoose.Schema(
  {
    // Tourist type
    touristType: {
      type: String,
      enum: ["domestic", "international"],
      required: true,
    },

    // Contact details
    phone: {
      type: String,
      required: true,
    },

    countryCode: {
      type: String,
      default: null, // only for international
    },

    // Visitors info
    visitors: {
      type: Number,
      required: true,
      min: 1,
    },

    fromCity: {
      type: String,
      default: null, // domestic only
    },

    country: {
      type: String,
      default: null, // international only
    },

    // Location info
    state: {
      type: String,
      required: true,
    },

    city: {
      type: String,
      required: true,
    },

    place: {
      type: String,
      required: true,
    },

    // Crowd snapshot at booking time
    crowdStatus: {
      type: String,
      enum: ["Low", "High", "Critical"],
      required: true,
    },

    crowdCountAtBooking: {
      type: Number,
      required: true,
    },

    // Metadata
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt
  }
);
module.exports = mongoose.model("Ticket", TicketSchema);
