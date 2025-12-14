const express = require("express");
const router = express.Router();
const TelecomFootfallAggregate = require("../models/TelecomFootfallAggregate");
const Hotel = require("../models/hotels");
const Ticket = require("../models/Ticket");

/**
 * 🔹 GET /dashboard/stats
 * Optimized dashboard KPIs (Telecom + Hotels)
 */
router.get("/stats", async (req, res) => {
  try {
    /* ================= TIME WINDOW ================= */
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

    /* ================= RUN ALL AGGS IN PARALLEL ================= */
    const [telecomAgg, ticketAgg, hotelAgg] = await Promise.all([
      /* ===== TELECOM ===== */
      TelecomFootfallAggregate.aggregate([
        {
          $match: {
            "time_window.start": { $gte: start, $lte: end },
            confidence_score: { $gte: 0.5 },
          },
        },
        {
          $project: {
            total: "$footfall.total_devices",
            domestic: "$footfall.domestic_devices",
            international: "$footfall.international_devices",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$total" },
            domestic: { $sum: "$domestic" },
            international: { $sum: "$international" },
          },
        },
      ]),

      /* ===== TICKETS ===== */
      Ticket.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            domestic: {
              $sum: {
                $cond: [{ $eq: ["$touristType", "domestic"] }, "$visitors", 0],
              },
            },
            international: {
              $sum: {
                $cond: [{ $eq: ["$touristType", "international"] }, "$visitors", 0],
              },
            },
          },
        },
      ]),

      /* ===== HOTELS ===== */
      Hotel.aggregate([
        {
          $group: {
            _id: null,
            totalRooms: { $sum: "$totalRooms" },
            totalVacancy: { $sum: "$vacancy" },
          },
        },
      ]),
    ]);

    /* ================= SAFE DEFAULTS ================= */
    const telecom = telecomAgg[0] || {
      total: 0,
      domestic: 0,
      international: 0,
    };

    const ticket = ticketAgg[0] || {
      domestic: 0,
      international: 0,
    };

    const hotel = hotelAgg[0] || {
      totalRooms: 0,
      totalVacancy: 0,
    };

    const occupiedRooms = hotel.totalRooms - hotel.totalVacancy;
    const occupancyRate =
      hotel.totalRooms > 0
        ? Math.round((occupiedRooms / hotel.totalRooms) * 100)
        : 0;

    /* ================= RESPONSE ================= */
    return res.json({
      success: true,
      timeWindow: {
        last24HoursFrom: start,
        to: end,
      },
      stats: {
        totalFootfall:
          telecom.total + ticket.domestic + ticket.international,

        domesticVisitors:
          telecom.domestic + ticket.domestic,

        internationalVisitors:
          telecom.international + ticket.international,

        hotelOccupancy: occupancyRate,
      },
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.get("/debug/ticket-stats", async (req, res) => {
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const data = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          domestic: {
            $sum: {
              $cond: [{ $eq: ["$touristType", "domestic"] }, "$visitors", 0],
            },
          },
          international: {
            $sum: {
              $cond: [{ $eq: ["$touristType", "international"] }, "$visitors", 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          domestic: 1,
          international: 1,
        },
      },
    ]);

    res.json({
      success: true,
      timeWindow: {
        from: start,
        to: end,
      },
      data: data[0] || { domestic: 0, international: 0 },
    });
  } catch (err) {
    console.error("Ticket debug stats error:", err);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});


router.get("/low-crowd", async (req, res) => {
  try {
    const {
      state = "Rajasthan",
      district,
      search,
      limit = 6,
    } = req.query;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    /* ================= BASE MATCH ================= */
    const telecomMatch = {
      "location.state": new RegExp(`^${state}$`, "i"),
      "time_window.end": { $gte: since },
      confidence_score: { $gte: 0.5 },
    };

    /* ================= SEARCH OVERRIDES DISTRICT ================= */
    if (search?.trim()) {
      const regex = new RegExp(search.trim(), "i");
      telecomMatch.$or = [
        { "location.tourist_place": regex },
        { "location.city": regex },
      ];
    } else if (district?.trim()) {
      telecomMatch.$or = [
        { "location.district": new RegExp(district.trim(), "i") },
        { "location.city": new RegExp(district.trim(), "i") },
      ];
    }

    /* ================= RUN QUERIES IN PARALLEL ================= */
    const [telecomData, ticketData] = await Promise.all([
      TelecomFootfallAggregate.aggregate([
        { $match: telecomMatch },
        {
          $addFields: {
            placeName: {
              $ifNull: ["$location.tourist_place", "$location.city"],
            },
          },
        },
        {
          $group: {
            _id: "$placeName",
            city: { $first: "$location.city" },
            district: { $first: "$location.district" },
            state: { $first: "$location.state" },
            telecomFootfall: { $avg: "$footfall.total_devices" },
          },
        },
        { $limit: 50 }, // performance cap
      ]),

      Ticket.aggregate([
        {
          $match: {
            state: new RegExp(`^${state}$`, "i"),
            ...(search?.trim() && {
              place: new RegExp(`^${search.trim()}$`, "i"),
            }),
            createdAt: { $gte: since },
          },
        },
        {
          $group: {
            _id: "$place",
            ticketFootfall: { $sum: "$visitors" },
          },
        },
      ]),
    ]);

    /* ================= MERGE ================= */
    const ticketMap = new Map(
      ticketData.map((t) => [t._id, t.ticketFootfall])
    );

    const merged = telecomData.map((t) => {
      const ticketCount = ticketMap.get(t._id) || 0;
      const crowdCount = Math.round(
        t.telecomFootfall * 0.7 + ticketCount * 0.3
      );

      return {
        name: t._id,
        city: t.city,
        district: t.district,
        state: t.state,
        crowdCount,
      };
    });

    /* ================= FINAL FILTER ================= */
    const recommendations = merged
      .filter((p) => p.crowdCount <= 15000)
      .sort((a, b) => a.crowdCount - b.crowdCount)
      .slice(0, Number(limit));

    return res.json({
      success: true,
      count: recommendations.length,
      recommendations,
    });
  } catch (err) {
    console.error("Low crowd error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});


router.get("/high-crowd", async (req, res) => {
  try {
    const {
      state = "Rajasthan",
      district,
      search,
      limit = 6,
    } = req.query;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    /* ================= BUILD MATCH ================= */
    const telecomMatch = {
      "location.state": state,
      "time_window.end": { $gte: since },
      confidence_score: { $gte: 0.5 },
    };

    if (district?.trim()) {
      telecomMatch["location.district"] = district;
    }

    if (search?.trim()) {
      telecomMatch.$or = [
        { "location.tourist_place": search },
        { "location.city": search },
      ];
    }

    /* ================= PARALLEL DB CALLS ================= */
    const [telecomData, ticketData] = await Promise.all([
      TelecomFootfallAggregate.aggregate([
        { $match: telecomMatch },
        {
          $addFields: {
            placeName: {
              $ifNull: ["$location.tourist_place", "$location.city"],
            },
          },
        },
        {
          $group: {
            _id: "$placeName",
            city: { $first: "$location.city" },
            district: { $first: "$location.district" },
            state: { $first: "$location.state" },
            telecomFootfall: { $avg: "$footfall.total_devices" },
          },
        },
        { $limit: 50 }, // ⛔ HARD LIMIT FOR SPEED
      ]),

      Ticket.aggregate([
        {
          $match: {
            state,
            ...(search?.trim() && { place: search }),
            createdAt: { $gte: since },
          },
        },
        {
          $group: {
            _id: "$place",
            ticketFootfall: { $sum: "$visitors" },
          },
        },
      ]),
    ]);

    /* ================= MERGE ================= */
    const ticketMap = new Map(
      ticketData.map((t) => [t._id, t.ticketFootfall])
    );

    const merged = telecomData.map((t) => {
      const ticketCount = ticketMap.get(t._id) || 0;

      const crowdCount = Math.round(
        t.telecomFootfall * 0.7 + ticketCount * 0.3
      );

      let crowdLevel = "Moderate";
      if (crowdCount >= 20000) crowdLevel = "Critical";
      else if (crowdCount >= 12000) crowdLevel = "High";

      return {
        name: t._id,
        city: t.city,
        district: t.district,
        state: t.state,
        crowdCount,
        crowdLevel,
      };
    });

    /* ================= FINAL FILTER ================= */
    const recommendations = merged
      .filter((p) => p.crowdCount >= 8000)
      .sort((a, b) => b.crowdCount - a.crowdCount)
      .slice(0, Number(limit));

    return res.json({
      success: true,
      count: recommendations.length,
      recommendations,
    });
  } catch (err) {
    console.error("High crowd error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.get("/hourly-crowd", async (req, res) => {
  try {
    const { state = "Rajasthan", district } = req.query;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    /* ================= BUILD MATCH (NO REGEX) ================= */
    const match = {
      "location.state": state,
      "time_window.end": { $gte: since },
      confidence_score: { $gte: 0.5 },
    };

    if (district?.trim()) {
      match.$or = [
        { "location.district": district },
        { "location.city": district },
      ];
    }

    /* ================= AGGREGATION ================= */
    const data = await TelecomFootfallAggregate.aggregate([
      { $match: match },

      // Reduce document size early
      {
        $project: {
          hour: {
            $dateTrunc: {
              date: "$time_window.end",
              unit: "hour",
            },
          },
          crowd: "$footfall.total_devices",
        },
      },

      {
        $group: {
          _id: "$hour",
          avgCrowd: { $avg: "$crowd" },
        },
      },

      { $sort: { _id: 1 } },

      {
        $project: {
          _id: 0,
          hour: {
            $hour: "$_id",
          },
          crowd: { $round: ["$avgCrowd", 0] },
        },
      },
    ]);

    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("Hourly crowd error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.get("/crowd-summary", async (req, res) => {
  try {
    const { state = "Rajasthan", district, limit = 5 } = req.query;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    /* ================= MATCH (NO REGEX) ================= */
    const match = {
      "location.state": state,
      "time_window.end": { $gte: since },
      confidence_score: { $gte: 0.5 },
    };

    if (district?.trim()) {
      match.$or = [
        { "location.district": district },
        { "location.city": district },
      ];
    }

    /* ================= AGGREGATION ================= */
    const data = await TelecomFootfallAggregate.aggregate([
      { $match: match },

      // Reduce payload immediately
      {
        $project: {
          place: {
            $ifNull: ["$location.tourist_place", "$location.city"],
          },
          crowd: "$footfall.total_devices",
        },
      },

      {
        $group: {
          _id: "$place",
          avgCrowd: { $avg: "$crowd" },
        },
      },

      { $sort: { avgCrowd: -1 } },

      { $limit: Number(limit) },

      {
        $project: {
          _id: 0,
          place: "$_id",
          crowd: { $round: ["$avgCrowd", 0] },
        },
      },
    ]);

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    console.error("Crowd summary error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.get("/best-visit-insights", (req, res) => {
  const { state = "Rajasthan" } = req.query;

  const insightsByState = {
    Rajasthan: {
      bestTime: "8 AM – 10 AM",
      bestSeason: "October – March",
      recommendation:
        "Early mornings during winter offer the best experience with fewer crowds.",
    },
  };

  const insight =
    insightsByState[state] || insightsByState.Rajasthan;

  res.json({
    success: true,
    state,
    ...insight,
  });
});

module.exports = router;
