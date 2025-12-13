const express = require("express");
const router = express.Router();
const TelecomFootfallAggregate = require("../models/TelecomFootfallAggregate");

/**
 * 🔹 GET /visitor/analytics
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

/**
 * 🔹 GET /visitor/analytics/timeseries
 * Time-wise tourist place footfall (last 24h default)
 */
router.get("/analytics/timeseries", async (req, res) => {
  try {
    const {
      state,
      city,
      tourist_place,
      startTime,
      endTime,
      interval = "hour", // hour | 15min
    } = req.query;

    /* ================= TIME WINDOW ================= */
    const end = endTime ? new Date(endTime) : new Date();
    const start = startTime
      ? new Date(startTime)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000); // last 24h

    /* ================= MATCH ================= */
    const match = {
      "time_window.start": { $gte: start, $lte: end },
    };

    if (state) match["location.state"] = state;
    if (city) match["location.city"] = city;
    if (tourist_place) match["location.tourist_place"] = tourist_place;

    /* ================= TIME BUCKET ================= */
    const timeBucket =
      interval === "15min"
        ? {
            year: { $year: "$time_window.start" },
            month: { $month: "$time_window.start" },
            day: { $dayOfMonth: "$time_window.start" },
            hour: { $hour: "$time_window.start" },
            minute: {
              $subtract: [
                { $minute: "$time_window.start" },
                { $mod: [{ $minute: "$time_window.start" }, 15] },
              ],
            },
          }
        : {
            year: { $year: "$time_window.start" },
            month: { $month: "$time_window.start" },
            day: { $dayOfMonth: "$time_window.start" },
            hour: { $hour: "$time_window.start" },
          };

    /* ================= AGGREGATION ================= */
    const data = await TelecomFootfallAggregate.aggregate([
      { $match: match },

      {
        $group: {
          _id: {
            time: timeBucket,
            tourist_place: "$location.tourist_place",
          },
          totalVisitors: { $sum: "$footfall.total_devices" },
          domesticVisitors: { $sum: "$footfall.domestic_devices" },
          internationalVisitors: {
            $sum: "$footfall.international_devices",
          },
        },
      },

      {
        $project: {
          _id: 0,
          time: {
            $dateFromParts: {
              year: "$_id.time.year",
              month: "$_id.time.month",
              day: "$_id.time.day",
              hour: "$_id.time.hour",
              minute: "$_id.time.minute",
            },
          },
          tourist_place: "$_id.tourist_place",
          totalVisitors: 1,
          domesticVisitors: 1,
          internationalVisitors: 1,
        },
      },

      { $sort: { time: 1 } },
    ]);

    res.json({
      success: true,
      interval,
      timeRange: { start, end },
      count: data.length,
      data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

module.exports = router;
