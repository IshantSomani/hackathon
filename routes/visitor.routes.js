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

    const start = startTime ? new Date(startTime) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endTime ? new Date(endTime) : new Date();

    /* ================= TELECOM ================= */
    const telecomMatch = {
      "time_window.start": { $gte: start, $lte: end },
    };
    if (state) telecomMatch["location.state"] = state;
    if (city) telecomMatch["location.city"] = city;
    if (tourist_place) telecomMatch["location.tourist_place"] = tourist_place;

    const telecomData = await TelecomFootfallAggregate.aggregate([
      { $match: telecomMatch },
      {
        $group: {
          _id: {
            state: "$location.state",
            city: "$location.city",
            tourist_place: "$location.tourist_place",
          },
          telecomTotal: { $sum: "$footfall.total_devices" },
          domesticVisitors: { $sum: "$footfall.domestic_devices" },
          internationalVisitors: { $sum: "$footfall.international_devices" },
          avgConfidence: { $avg: "$confidence_score" },
        },
      },
    ]);

    /* ================= TICKETS ================= */
    const ticketMatch = {
      createdAt: { $gte: start, $lte: end },
    };
    if (state) ticketMatch.state = state;
    if (city) ticketMatch.city = city;
    if (tourist_place) {
      ticketMatch.place = { $regex: new RegExp(`^${tourist_place}$`, "i") };
    }

    const ticketData = await Ticket.aggregate([
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
    ]);

    /* ================= MERGE ================= */
    const ticketMap = {};
    ticketData.forEach((t) => {
      const key = `${t._id.state}__${t._id.city}__${t._id.tourist_place}`;
      ticketMap[key] = t.ticketVisitors;
    });

    const data = telecomData.map((t) => {
      const key = `${t._id.state}__${t._id.city}__${t._id.tourist_place}`;
      const ticketVisitors = ticketMap[key] || 0;

      return {
        location: t._id,
        totalVisitors: t.telecomTotal + ticketVisitors,
        domesticVisitors: t.domesticVisitors,
        internationalVisitors: t.internationalVisitors,
        avgConfidence: Math.round(t.avgConfidence * 100) / 100,
        ticketVisitors,
      };
    });

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
      interval = "hour",
    } = req.query;

    const end = endTime ? new Date(endTime) : new Date();
    const start = startTime
      ? new Date(startTime)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    /* ================= TELECOM MATCH ================= */
    const telecomMatch = {
      "time_window.start": { $gte: start, $lte: end },
    };
    if (state) telecomMatch["location.state"] = state;
    if (city) telecomMatch["location.city"] = city;
    if (tourist_place) telecomMatch["location.tourist_place"] = tourist_place;

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

    /* ================= TELECOM SERIES ================= */
    const telecomSeries = await TelecomFootfallAggregate.aggregate([
      { $match: telecomMatch },
      {
        $group: {
          _id: {
            time: timeBucket,
            tourist_place: "$location.tourist_place",
          },
          telecomTotal: { $sum: "$footfall.total_devices" },
          domesticVisitors: { $sum: "$footfall.domestic_devices" },
          internationalVisitors: { $sum: "$footfall.international_devices" },
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
          telecomTotal: 1,
          domesticVisitors: 1,
          internationalVisitors: 1,
        },
      },
    ]);

    /* ================= TICKET SERIES ================= */
    const ticketSeries = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          ...(state && { state }),
          ...(city && { city }),
          ...(tourist_place && {
            place: { $regex: new RegExp(`^${tourist_place}$`, "i") },
          }),
        },
      },
      {
        $project: {
          time: {
            $dateTrunc: {
              date: "$createdAt",
              unit: interval === "15min" ? "minute" : "hour",
              binSize: interval === "15min" ? 15 : 1,
            },
          },
          visitors: "$visitors",
          place: "$place",
        },
      },
      {
        $group: {
          _id: { time: "$time", tourist_place: "$place" },
          ticketVisitors: { $sum: "$visitors" },
        },
      },
    ]);

    /* ================= MERGE ================= */
    const seriesMap = {};

    telecomSeries.forEach((t) => {
      const key = `${t.time.toISOString()}__${t.tourist_place}`;
      seriesMap[key] = {
        time: t.time,
        tourist_place: t.tourist_place,
        totalVisitors: t.telecomTotal,
        domesticVisitors: t.domesticVisitors,
        internationalVisitors: t.internationalVisitors,
      };
    });

    ticketSeries.forEach((t) => {
      const key = `${t._id.time.toISOString()}__${t._id.tourist_place}`;
      if (!seriesMap[key]) {
        seriesMap[key] = {
          time: t._id.time,
          tourist_place: t._id.tourist_place,
          totalVisitors: 0,
          domesticVisitors: 0,
          internationalVisitors: 0,
        };
      }
      seriesMap[key].totalVisitors += t.ticketVisitors;
    });

    const data = Object.values(seriesMap).sort((a, b) => a.time - b.time);

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
