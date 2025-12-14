const express = require("express");
const router = express.Router();
const TelecomFootfallAggregate = require("../models/TelecomFootfallAggregate");
const Ticket = require("../models/Ticket");

/**
 * 🔹 GET /visitor/analytics
 * Telecom-based visitor analytics
 */
router.get("/analytics", async (req, res) => {
  try {
    const { state, city, tourist_place, startTime, endTime } = req.query;

    const end = endTime ? new Date(endTime) : new Date();
    const start = startTime
      ? new Date(startTime)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    /* ================= TELECOM MATCH ================= */
    const telecomMatch = {
      "time_window.start": { $gte: start, $lte: end },
      confidence_score: { $gte: 0.5 },
    };

    if (state) telecomMatch["location.state"] = state;
    if (city) telecomMatch["location.city"] = city;
    if (tourist_place) telecomMatch["location.tourist_place"] = tourist_place;

    /* ================= TICKET MATCH ================= */
    const ticketMatch = {
      createdAt: { $gte: start, $lte: end },
    };

    if (state) ticketMatch.state = state;
    if (city) ticketMatch.city = city;
    if (tourist_place) ticketMatch.place = tourist_place; // ❌ NO REGEX

    /* ================= RUN IN PARALLEL ================= */
    const [telecomData, ticketData] = await Promise.all([
      /* ===== TELECOM ===== */
      TelecomFootfallAggregate.aggregate([
        { $match: telecomMatch },

        // Reduce payload early
        {
          $project: {
            state: "$location.state",
            city: "$location.city",
            place: "$location.tourist_place",
            total: "$footfall.total_devices",
            domestic: "$footfall.domestic_devices",
            international: "$footfall.international_devices",
            confidence: "$confidence_score",
          },
        },

        {
          $group: {
            _id: {
              state: "$state",
              city: "$city",
              tourist_place: "$place",
            },
            telecomTotal: { $sum: "$total" },
            domesticVisitors: { $sum: "$domestic" },
            internationalVisitors: { $sum: "$international" },
            avgConfidence: { $avg: "$confidence" },
          },
        },
      ]),

      /* ===== TICKETS ===== */
      Ticket.aggregate([
        { $match: ticketMatch },
        {
          $group: {
            _id: {
              state: "$state",
              city: "$city",
              tourist_place: "$place",
            },
            ticketVisitors: { $sum: "$visitors" },
          },
        },
      ]),
    ]);

    /* ================= MERGE ================= */
    const ticketMap = new Map();
    ticketData.forEach((t) => {
      ticketMap.set(
        `${t._id.state}__${t._id.city}__${t._id.tourist_place}`,
        t.ticketVisitors
      );
    });

    const data = telecomData.map((t) => {
      const key = `${t._id.state}__${t._id.city}__${t._id.tourist_place}`;
      const ticketVisitors = ticketMap.get(key) || 0;

      return {
        location: t._id,
        totalVisitors: t.telecomTotal + ticketVisitors,
        domesticVisitors: t.domesticVisitors,
        internationalVisitors: t.internationalVisitors,
        avgConfidence: Math.round(t.avgConfidence * 100) / 100,
        ticketVisitors,
      };
    });

    return res.json({
      success: true,
      count: data.length,
      timeWindow: { from: start, to: end },
      data,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch analytics",
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
      interval = "hour",
    } = req.query;

    const end = endTime ? new Date(endTime) : new Date();
    const start = startTime
      ? new Date(startTime)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const unit = interval === "15min" ? "minute" : "hour";
    const binSize = interval === "15min" ? 15 : 1;

    /* ================= TELECOM MATCH ================= */
    const telecomMatch = {
      "time_window.start": { $gte: start, $lte: end },
      confidence_score: { $gte: 0.5 },
      ...(state && { "location.state": state }),
      ...(city && { "location.city": city }),
      ...(tourist_place && {
        "location.tourist_place": tourist_place,
      }),
    };

    /* ================= TICKET MATCH ================= */
    const ticketMatch = {
      createdAt: { $gte: start, $lte: end },
      ...(state && { state }),
      ...(city && { city }),
      ...(tourist_place && { place: tourist_place }), // ❌ NO REGEX
    };

    /* ================= RUN IN PARALLEL ================= */
    const [telecomSeries, ticketSeries] = await Promise.all([
      /* ===== TELECOM ===== */
      TelecomFootfallAggregate.aggregate([
        { $match: telecomMatch },

        {
          $project: {
            time: {
              $dateTrunc: {
                date: "$time_window.start",
                unit,
                binSize,
              },
            },
            place: "$location.tourist_place",
            total: "$footfall.total_devices",
            domestic: "$footfall.domestic_devices",
            international: "$footfall.international_devices",
          },
        },

        {
          $group: {
            _id: { time: "$time", place: "$place" },
            telecomTotal: { $sum: "$total" },
            domesticVisitors: { $sum: "$domestic" },
            internationalVisitors: { $sum: "$international" },
          },
        },
      ]),

      /* ===== TICKETS ===== */
      Ticket.aggregate([
        { $match: ticketMatch },

        {
          $project: {
            time: {
              $dateTrunc: {
                date: "$createdAt",
                unit,
                binSize,
              },
            },
            visitors: "$visitors",
            place: "$place",
          },
        },

        {
          $group: {
            _id: { time: "$time", place: "$place" },
            ticketVisitors: { $sum: "$visitors" },
          },
        },
      ]),
    ]);

    /* ================= MERGE SERIES ================= */
    const seriesMap = new Map();

    telecomSeries.forEach((t) => {
      const key = `${t._id.time.getTime()}__${t._id.place}`;
      seriesMap.set(key, {
        time: t._id.time,
        tourist_place: t._id.place,
        totalVisitors: t.telecomTotal,
        domesticVisitors: t.domesticVisitors,
        internationalVisitors: t.internationalVisitors,
      });
    });

    ticketSeries.forEach((t) => {
      const key = `${t._id.time.getTime()}__${t._id.place}`;
      if (!seriesMap.has(key)) {
        seriesMap.set(key, {
          time: t._id.time,
          tourist_place: t._id.place,
          totalVisitors: 0,
          domesticVisitors: 0,
          internationalVisitors: 0,
        });
      }
      seriesMap.get(key).totalVisitors += t.ticketVisitors;
    });

    const data = Array.from(seriesMap.values()).sort(
      (a, b) => a.time - b.time
    );

    return res.json({
      success: true,
      interval,
      timeRange: { start, end },
      count: data.length,
      data,
    });
  } catch (err) {
    console.error("Analytics timeseries error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch analytics time series",
    });
  }
});


module.exports = router;
