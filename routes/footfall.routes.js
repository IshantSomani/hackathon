const express = require("express");
const router = express.Router();
const TelecomFootfallAggregate = require("../models/TelecomFootfallAggregate");
const Ticket = require("../models/Ticket");
const TouristPlace = require("../models/TouristPlace"); 

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

    const since =
      startDate || endDate
        ? new Date(startDate || Date.now() - 24 * 60 * 60 * 1000)
        : new Date(Date.now() - 24 * 60 * 60 * 1000);

    /* ---------------- TELECOM DATA ---------------- */
    const telecomData = await TelecomFootfallAggregate.aggregate([
      {
        $match: {
          "location.state": state,
          ...(startDate || endDate
            ? {
                "time_window.start": {
                  ...(startDate && { $gte: new Date(startDate) }),
                  ...(endDate && { $lte: new Date(endDate) }),
                },
              }
            : {}),
        },
      },
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
    ]);

    /* ---------------- TICKET DATA (LAST 24H) ---------------- */
    const ticketAgg = await Ticket.aggregate([
      {
        $match: {
          state,
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: {
            city: "$city",
            place: "$place",
          },
          visitors: { $sum: "$visitors" },
        },
      },
    ]);

    /* ---------------- MAP TICKETS ---------------- */
    const ticketMap = {};
    ticketAgg.forEach((t) => {
      const key = `${t._id.city}__${t._id.place}`;
      ticketMap[key] = t.visitors;
    });

    /* ---------------- MERGE ---------------- */
    const cityMap = {};

    telecomData.forEach((p) => {
      const city = p._id.city;
      const place = p._id.place;
      const key = `${city}__${place}`;

      const ticketVisitors = ticketMap[key] || 0;

      if (!cityMap[city]) {
        cityMap[city] = { places: [] };
      }

      cityMap[city].places.push({
        name: place,
        total: p.total + ticketVisitors, // ✅ merged
        domestic: p.domestic,
        international: p.international,
        confidence_score: p.confidence_score,
        international_breakdown: p.international_breakdown,
        network_distribution: p.network_distribution,
        ticketVisitors, // 🔥 optional but useful
      });
    });

    res.status(200).json({
      success: true,
      cities: cityMap,
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
    const { state = "Rajasthan", city, tourist_place } = req.query;

    if (!city || !tourist_place) {
      return res.status(400).json({
        success: false,
        message: "city and tourist_place are required",
      });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    /* ================= TELECOM ================= */
    const telecomSeries = await TelecomFootfallAggregate.aggregate([
      {
        $match: {
          "location.state": state,
          "location.city": city,
          "location.tourist_place": tourist_place,
          "time_window.start": { $gte: since },
        },
      },
      {
        $project: {
          hour: {
            $dateToString: {
              format: "%Y-%m-%d %H:00",
              date: "$time_window.start",
            },
          },
          visitors: "$footfall.total_devices",
        },
      },
      {
        $group: {
          _id: "$hour",
          visitors: { $avg: "$visitors" },
        },
      },
    ]);

    /* ================= TICKETS (FIXED MATCH) ================= */
    const ticketSeries = await Ticket.aggregate([
      {
        $match: {
          state,
          city,
          place: { $regex: new RegExp(`^${tourist_place}$`, "i") },
          createdAt: { $gte: since },
        },
      },
      {
        $project: {
          hour: {
            $dateToString: {
              format: "%Y-%m-%d %H:00",
              date: "$createdAt",
            },
          },
          visitors: "$visitors",
        },
      },
      {
        $group: {
          _id: "$hour",
          visitors: { $sum: "$visitors" },
        },
      },
    ]);

    /* ================= MERGE ================= */
    const seriesMap = {};

    telecomSeries.forEach((t) => {
      seriesMap[t._id] = {
        time: t._id.split(" ")[1],
        visitors: Math.round(t.visitors),
      };
    });

    ticketSeries.forEach((t) => {
      if (!seriesMap[t._id]) {
        seriesMap[t._id] = {
          time: t._id.split(" ")[1],
          visitors: 0,
        };
      }
      seriesMap[t._id].visitors += t.visitors;
    });

    const series = Object.values(seriesMap).sort((a, b) =>
      a.time.localeCompare(b.time)
    );

    res.json({ success: true, series });
  } catch (err) {
    console.error("Footfall series error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch time series",
    });
  }
});



router.post("/tickets/create", async (req, res) => {
  try {
    const {
      touristType,
      phone,
      countryCode,
      visitors,
      fromCity,
      country,
      state,
      city,
      place,
      crowdStatus,
      crowdCountAtBooking,
    } = req.body;

    // 1️⃣ Save ticket (FIXED)
    const ticket = await Ticket.create({
      touristType,
      phone,
      countryCode,
      visitors,
      fromCity,
      country,
      state,
      city,
      place,
      crowdStatus,
      crowdCountAtBooking,
      createdAt: new Date(),
    });

    // 2️⃣ Update footfall
    await TouristPlace.findOneAndUpdate(
      { state, city, name: place },
      {
        $inc: { crowdCount: Number(visitors) },
        $push: {
          footfallHistory: {
            time: new Date(),
            visitors: Number(visitors),
          },
        },
      },
      { upsert: true } // ✅ important safety
    );

    res.json({
      success: true,
      message: "Ticket created & footfall updated",
      ticket,
    });
  } catch (err) {
    console.error("Ticket create error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});


module.exports = router;
