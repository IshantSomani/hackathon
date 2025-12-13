const mongoose = require("mongoose");

const hotelSchema = new mongoose.Schema(
  {
    S_No: { type: Number, required: true, unique: true, index: true },
    Name: { type: String, required: true, trim: true, index: true },
    Address: { type: String, required: true },
    Rating: { type: Number, min: 0, max: 5, index: true },
    Reviews: { type: Number, default: null },
    City: { type: String, required: true, index: true },
    totalRooms: { type: Number, required: true, min: 0 },
    vacancy: { type: Number, required: true, min: 0, index: true },

    category: {
      type: String,
      // enum: [
      //   "Hotel",
      //   "Budget Hotel",
      //   "Resort",
      //   "Hostel",
      //   "Tourist Place",
      //   "Museum",
      //   "Zoo",
      //   "Garden",
      // ],
      default: "Hotel",
      index: true,
    },

    nearbyPlaces: {
      type: [String],
      default: [],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Hotel", hotelSchema);
