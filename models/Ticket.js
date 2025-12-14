const mongoose = require("mongoose");

const TicketSchema = new mongoose.Schema(
  {
    touristType: {
      type: String,
      enum: ["DOMESTIC", "INTERNATIONAL"],
      required: true,
      index: true,
    },

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
  { timestamps: true }
);

/* ✅ FIXED PRE-SAVE MIDDLEWARE (NO next) */
TicketSchema.pre("save", function () {
  if (this.touristType === "DOMESTIC") {
    this.country = null;
  }

  if (this.touristType === "INTERNATIONAL") {
    this.fromCity = null;
  }
});

/* INDEXES */
TicketSchema.index({ state: 1, city: 1, place: 1, createdAt: -1 });
TicketSchema.index({ touristType: 1, createdAt: -1 });
TicketSchema.index({ crowdStatus: 1, createdAt: -1 });
TicketSchema.index({ phone: 1, createdAt: -1 });

module.exports = mongoose.model("Ticket", TicketSchema);
