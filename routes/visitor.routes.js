const express = require("express");
const router = express.Router();
const TelecomFootfallAggregate = require("../models/TelecomFootfallAggregate");

/**
 * 🔹 GET /analytics
 * Telecom-based visitor analytics
 */
router.get("/analytics", async (req, res) => {
  try {
    const { state, city, tourist_place, startTime, endTime } = req.query;

    const match = {};

    if (state) match["location.state"] = state;
    if (city) match["location.city"] = city;
    if (tourist_place) match["location.tourist_place"] = tourist_place;

    if (startTime || endTime) {
      match["time_window.start"] = {};
      if (startTime) match["time_window.start"].$gte = new Date(startTime);
      if (endTime) match["time_window.start"].$lte = new Date(endTime);
    }

    const data = await TelecomFootfallAggregate.aggregate([
      { $match: match },

      {
        $group: {
          _id: {
            state: "$location.state",
            city: "$location.city",
            tourist_place: "$location.tourist_place",
          },
          totalVisitors: { $sum: "$footfall.total_devices" },
          domesticVisitors: { $sum: "$footfall.domestic_devices" },
          internationalVisitors: {
            $sum: "$footfall.international_devices",
          },
          avgConfidence: { $avg: "$confidence_score" },
        },
      },

      {
        $project: {
          _id: 0,
          location: "$_id",
          totalVisitors: 1,
          domesticVisitors: 1,
          internationalVisitors: 1,
          avgConfidence: { $round: ["$avgConfidence", 2] },
        },
      },

      { $sort: { totalVisitors: -1 } },
    ]);

    res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

module.exports = router;
