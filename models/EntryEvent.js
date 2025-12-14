const mongoose = require("mongoose");

const GeoLocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: Number,
  },
  { _id: false }
);

const EntryEventSchema = new mongoose.Schema(
  {
    /* ================= EVENT TYPE ================= */
    eventType: {
      type: String,
      enum: ["ENTRY", "EXIT"],
      default: "ENTRY",
      index: true,
    },

    /* ================= SOURCE ================= */
    source: {
      type: String,
      enum: ["QR_CHECKIN", "MANUAL", "SYSTEM"],
      default: "QR_CHECKIN",
    },

    /* ================= REFERENCES ================= */
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      index: true,
    },

    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TouristPlace",
      required: true,
      index: true,
    },

    /* ================= VISITOR ================= */
    visitorType: {
      type: String,
      enum: ["DOMESTIC", "INTERNATIONAL", "UNKNOWN"],
      required: true,
      index: true,
    },

    verificationLevel: {
      type: String,
      enum: ["SELF_DECLARED", "TICKET_VERIFIED"],
      default: "SELF_DECLARED",
    },

    /* ================= GEO ================= */
    geoOptedIn: {
      type: Boolean,
      default: false,
    },

    geoLocation: {
      type: GeoLocationSchema,
      default: null,
    },

    /* ================= EVENT TIME ================= */
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true, // createdAt & updatedAt (system time)
  }
);

/* ================= INDEXES ================= */

// Fast analytics by location & time
EntryEventSchema.index({ locationId: 1, occurredAt: -1 });

// Visitor breakdown
EntryEventSchema.index({ visitorType: 1, occurredAt: -1 });

// Entry/Exit tracking
EntryEventSchema.index({ eventType: 1, locationId: 1, occurredAt: -1 });

// Geo analytics (optional)
EntryEventSchema.index({
  "geoLocation.latitude": 1,
  "geoLocation.longitude": 1,
});

module.exports = mongoose.model("EntryEvent", EntryEventSchema);
