const express = require("express");
const router = express.Router();
const TelecomFootfallAggregate = require("../models/TelecomFootfallAggregate");

/**
 * GET /api/footfall
 * Query params:
 *  - state
 *  - startDate
 *  - endDate
 */
router.get("/footfall", async (req, res) => {
  try {
    const { state = "Rajasthan", startDate, endDate } = req.query;

    /* ---------------- MATCH FILTER ---------------- */
    const match = { "location.state": state };

    if (startDate || endDate) {
      match["time_window.start"] = {};
      if (startDate) match["time_window.start"].$gte = new Date(startDate);
      if (endDate) match["time_window.start"].$lte = new Date(endDate);
    }

    /* ---------------- AGGREGATE CITY → PLACE ---------------- */
    const aggregated = await TelecomFootfallAggregate.aggregate([
      { $match: match },

      /* take latest window per place */
      {
        $sort: {
          "location.city": 1,
          "location.tourist_place": 1,
          "time_window.start": -1,
        },
      },

      {
        $group: {
          _id: {
            city: "$location.city",
            place: "$location.tourist_place",
          },
          total: { $first: "$footfall.total_devices" },
          domestic: { $first: "$footfall.domestic_devices" },
          international: { $first: "$footfall.international_devices" },
          confidence_score: { $first: "$confidence_score" },
          international_breakdown: { $first: "$international_breakdown" },
          network_distribution: { $first: "$network_distribution" },
        },
      },

      {
        $group: {
          _id: "$_id.city",
          places: {
            $push: {
              name: "$_id.place",
              total: "$total",
              domestic: "$domestic",
              international: "$international",
              confidence_score: "$confidence_score",
              international_breakdown: "$international_breakdown",
              network_distribution: "$network_distribution",
            },
          },
        },
      },

      {
        $project: {
          _id: 0,
          city: "$_id",
          places: 1,
        },
      },
    ]);

    /* ---------------- FORMAT RESPONSE ---------------- */
    const cities = {};
    aggregated.forEach((c) => {
      cities[c.city] = { places: c.places };
    });

    res.status(200).json({
      success: true,
      cities,
    });
  } catch (error) {
    console.error("Footfall API error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch footfall data",
    });
  }
});

router.get("/footfall/series", async (req, res) => {
  try {
    const {
      state = "Rajasthan",
      city,
      tourist_place,
    } = req.query;

    if (!city || !tourist_place) {
      return res.status(400).json({
        success: false,
        message: "city and tourist_place are required",
      });
    }

    const series = await TelecomFootfallAggregate.aggregate([
      {
        $match: {
          "location.state": state,
          "location.city": city,
          "location.tourist_place": tourist_place,
        },
      },

      { $sort: { "time_window.start": 1 } },

      {
        $project: {
          _id: 0,
          time: {
            $dateToString: {
              format: "%H:%M",
              date: "$time_window.start",
            },
          },
          visitors: "$footfall.total_devices",
        },
      },
    ]);

    res.json({
      success: true,
      series,
    });
  } catch (err) {
    console.error("Footfall series error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch time series",
    });
  }
});


module.exports = router;
