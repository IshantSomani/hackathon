const mongoose = require("mongoose");

const GeoLocationSchema = new mongoose.Schema(
  {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
  },
  { _id: false }
);

const EntryEventSchema = new mongoose.Schema(
  {
    // ENTRY / EXIT (future proof)
    eventType: {
      type: String,
      enum: ["ENTRY", "EXIT"],
      default: "ENTRY",
    },

    // How the event was created
    source: {
      type: String,
      enum: ["QR_CHECKIN", "MANUAL", "SYSTEM"],
      default: "QR_CHECKIN",
    },

    // 🔑 Link to ticket
    ticketId: {
      type: String,
      required: true,
      index: true,
    },

    locationId: {
      type: String,
      required: true,
      index: true,
    },

    visitorType: {
      type: String,
      enum: ["DOMESTIC", "INTERNATIONAL", "UNKNOWN"],
      required: true,
    },

    verificationLevel: {
      type: String,
      enum: ["SELF_DECLARED", "TICKET_VERIFIED"],
      default: "SELF_DECLARED",
    },

    geoOptedIn: {
      type: Boolean,
      default: false,
    },

    geoLocation: {
      type: GeoLocationSchema,
      default: null,
    },

    // When scan happened
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true, // createdAt & updatedAt
  }
);

module.exports = mongoose.model("EntryEvent", EntryEventSchema);
