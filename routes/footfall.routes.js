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

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    /* ================= RUN IN PARALLEL ================= */
    const [telecomData, ticketAgg] = await Promise.all([
      /* ============ TELECOM DATA ============ */
      TelecomFootfallAggregate.aggregate([
        {
          $match: {
            "location.state": state,
            "time_window.start": { $gte: start, $lte: end },
            confidence_score: { $gte: 0.5 },
          },
        },

        // Reduce payload early
        {
          $project: {
            city: "$location.city",
            place: "$location.tourist_place",
            time: "$time_window.start",
            total: "$footfall.total_devices",
            domestic: "$footfall.domestic_devices",
            international: "$footfall.international_devices",
            confidence_score: 1,
            international_breakdown: 1,
            network_distribution: 1,
          },
        },

        // Latest record per city+place
        {
          $group: {
            _id: { city: "$city", place: "$place" },
            total: { $first: "$total" },
            domestic: { $first: "$domestic" },
            international: { $first: "$international" },
            confidence_score: { $first: "$confidence_score" },
            international_breakdown: { $first: "$international_breakdown" },
            network_distribution: { $first: "$network_distribution" },
          },
        },
      ]),

      /* ============ TICKET DATA ============ */
      Ticket.aggregate([
        {
          $match: {
            state,
            createdAt: { $gte: start, $lte: end },
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
      ]),
    ]);

    /* ================= MAP TICKETS ================= */
    const ticketMap = new Map();
    ticketAgg.forEach((t) => {
      ticketMap.set(`${t._id.city}__${t._id.place}`, t.visitors);
    });

    /* ================= MERGE ================= */
    const cityMap = {};

    telecomData.forEach((p) => {
      const city = p._id.city;
      const place = p._id.place;
      const key = `${city}__${place}`;

      const ticketVisitors = ticketMap.get(key) || 0;

      if (!cityMap[city]) {
        cityMap[city] = { places: [] };
      }

      cityMap[city].places.push({
        name: place,
        total: p.total + ticketVisitors,
        domestic: p.domestic,
        international: p.international,
        confidence_score: p.confidence_score,
        international_breakdown: p.international_breakdown,
        network_distribution: p.network_distribution,
        ticketVisitors,
      });
    });

    return res.json({
      success: true,
      timeWindow: { from: start, to: end },
      cities: cityMap,
    });
  } catch (error) {
    console.error("Footfall API error:", error);
    return res.status(500).json({
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

    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

    /* ================= RUN IN PARALLEL ================= */
    const [telecomSeries, ticketSeries] = await Promise.all([
      /* ============ TELECOM ============ */
      TelecomFootfallAggregate.aggregate([
        {
          $match: {
            "location.state": state,
            "location.city": city,
            "location.tourist_place": tourist_place,
            "time_window.start": { $gte: start, $lte: end },
            confidence_score: { $gte: 0.5 },
          },
        },
        {
          $project: {
            hour: {
              $dateTrunc: {
                date: "$time_window.start",
                unit: "hour",
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
      ]),

      /* ============ TICKETS ============ */
      Ticket.aggregate([
        {
          $match: {
            state,
            city,
            place: tourist_place, // ❌ NO REGEX
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $project: {
            hour: {
              $dateTrunc: {
                date: "$createdAt",
                unit: "hour",
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
      ]),
    ]);

    /* ================= MERGE SERIES ================= */
    const seriesMap = new Map();

    telecomSeries.forEach((t) => {
      seriesMap.set(t._id.getTime(), {
        time: t._id,
        visitors: Math.round(t.visitors),
      });
    });

    ticketSeries.forEach((t) => {
      const key = t._id.getTime();
      if (!seriesMap.has(key)) {
        seriesMap.set(key, { time: t._id, visitors: 0 });
      }
      seriesMap.get(key).visitors += t.visitors;
    });

    const series = Array.from(seriesMap.values())
      .sort((a, b) => a.time - b.time)
      .map((d) => ({
        time: d.time.toISOString().slice(11, 16), // HH:mm
        visitors: d.visitors,
      }));

    return res.json({
      success: true,
      series,
    });
  } catch (err) {
    console.error("Footfall series error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch time series",
    });
  }
});

router.post("/tickets/create", async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let {
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

    if (!touristType || !visitors || !state || !city || !place) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const visitorCount = Number(visitors);
    if (isNaN(visitorCount) || visitorCount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid visitors count",
      });
    }

    /* 🔥 FIX ENUM MISMATCH */
    touristType = touristType.toUpperCase();

    if (!["DOMESTIC", "INTERNATIONAL"].includes(touristType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid touristType",
      });
    }

    session.startTransaction();

    const [ticket] = await Ticket.create(
      [
        {
          touristType,
          phone,
          countryCode,
          visitors: visitorCount,
          fromCity,
          country,
          state,
          city,
          place,
          crowdStatus,
          crowdCountAtBooking,
        },
      ],
      { session }
    );

    await TouristPlace.findOneAndUpdate(
      { state, city, name: place },
      {
        $inc: { crowdCount: visitorCount },
        $push: {
          footfallHistory: {
            time: new Date(),
            visitors: visitorCount,
          },
        },
      },
      {
        session,
        upsert: true, // 🔥 critical
      }
    );

    await session.commitTransaction();
    session.endSession();

    return res.json({
      success: true,
      ticketId: ticket._id,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("Ticket create error:", err.message);

    return res.status(500).json({
      success: false,
      message: err.message, // 🔥 show real error
    });
  }
});


module.exports = router;
