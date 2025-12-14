const mongoose = require("mongoose");

const TicketSchema = new mongoose.Schema(
  {
    /* ================= TOURIST TYPE ================= */
    touristType: {
      type: String,
      enum: ["DOMESTIC", "INTERNATIONAL"],
      required: true,
      index: true,
    },

    /* ================= CONTACT ================= */
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    countryCode: {
      type: String,
      default: null,
    },

    /* ================= VISITORS ================= */
    visitors: {
      type: Number,
      required: true,
      min: 1,
    },

    fromCity: {
      type: String,
      default: null,
    },

    country: {
      type: String,
      default: null,
    },

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

    place: {
      type: String,
      required: true,
      index: true,
    },

    /* ================= CROWD SNAPSHOT ================= */
    crowdStatus: {
      type: String,
      enum: ["Low", "High", "Critical"],
      required: true,
      index: true,
    },

    crowdCountAtBooking: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true, // createdAt & updatedAt
  }
);

/* ================= VALIDATION ================= */
TicketSchema.pre("save", function (next) {
  if (this.touristType === "DOMESTIC") {
    this.country = null;
  }

  if (this.touristType === "INTERNATIONAL") {
    this.fromCity = null;
  }

  next();
});

/* ================= INDEX STRATEGY ================= */

// Most-used analytics queries
TicketSchema.index({ state: 1, city: 1, place: 1, createdAt: -1 });

// Visitor type analytics
TicketSchema.index({ touristType: 1, createdAt: -1 });

// Crowd-status analysis
TicketSchema.index({ crowdStatus: 1, createdAt: -1 });

// Phone-based lookups (optional)
TicketSchema.index({ phone: 1, createdAt: -1 });

module.exports = mongoose.model("Ticket", TicketSchema);
