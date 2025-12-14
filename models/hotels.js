const mongoose = require("mongoose");

const hotelSchema = new mongoose.Schema(
  {
    S_No: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },

    Name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    Address: {
      type: String,
      required: true,
    },

    Rating: {
      type: Number,
      min: 0,
      max: 5,
      index: true,
    },

    Reviews: {
      type: Number,
      default: null,
    },

    City: {
      type: String,
      required: true,
      index: true,
    },

    totalRooms: {
      type: Number,
      required: true,
      min: 0,
    },

    vacancy: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function (v) {
          return v <= this.totalRooms;
        },
        message: "Vacancy cannot exceed total rooms",
      },
      index: true,
    },

    /* ================= DERIVED ================= */
    occupancyPercent: {
      type: Number,
      min: 0,
      max: 100,
      index: true,
    },

    category: {
      type: String,
      default: "Hotel",
      index: true,
    },

    nearbyPlaces: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

/* ================= PRE-SAVE HOOK ================= */
hotelSchema.pre("save", function (next) {
  if (this.totalRooms > 0) {
    const occupied = this.totalRooms - this.vacancy;
    this.occupancyPercent = Math.round(
      (occupied / this.totalRooms) * 100
    );
  } else {
    this.occupancyPercent = 0;
  }
  next();
});

/* ================= INDEX STRATEGY ================= */

// Fast filtering
hotelSchema.index({ City: 1, category: 1 });
hotelSchema.index({ City: 1, Rating: -1 });
hotelSchema.index({ City: 1, vacancy: 1 });
hotelSchema.index({ City: 1, occupancyPercent: 1 });

// Text search (Name + nearbyPlaces)
hotelSchema.index(
  {
    Name: "text",
    nearbyPlaces: "text",
  },
  {
    weights: {
      Name: 5,
      nearbyPlaces: 2,
    },
  }
);

module.exports = mongoose.model("Hotel", hotelSchema);
