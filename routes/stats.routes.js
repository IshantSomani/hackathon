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
    /* ======================================================
       1️⃣ TIME WINDOW (USE REAL TIME)
    ====================================================== */
    const end = new Date(); // ✅ FIX: always NOW
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

    /* ======================================================
       2️⃣ TELECOM AGGREGATION (SAFE IF LAGGING)
    ====================================================== */
    const telecomAgg = await TelecomFootfallAggregate.aggregate([
      {
        $match: {
          "time_window.start": { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$footfall.total_devices" },
          domestic: { $sum: "$footfall.domestic_devices" },
          international: { $sum: "$footfall.international_devices" },
        },
      },
    ]);

    const telecom = telecomAgg[0] || {
      total: 0,
      domestic: 0,
      international: 0,
    };

    /* ======================================================
       3️⃣ TICKET AGGREGATION (REAL-TIME)
    ====================================================== */
    const ticketAgg = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$touristType",
          visitors: { $sum: "$visitors" },
        },
      },
    ]);

    let ticketDomestic = 0;
    let ticketInternational = 0;

    ticketAgg.forEach((t) => {
      if (t._id === "domestic") ticketDomestic = t.visitors;
      if (t._id === "international") ticketInternational = t.visitors;
    });

    /* ======================================================
       4️⃣ HOTEL OCCUPANCY
    ====================================================== */
    const hotelAgg = await Hotel.aggregate([
      {
        $group: {
          _id: null,
          totalRooms: { $sum: "$totalRooms" },
          totalVacancy: { $sum: "$vacancy" },
        },
      },
    ]);

    const hotel = hotelAgg[0] || { totalRooms: 0, totalVacancy: 0 };
    const occupiedRooms = hotel.totalRooms - hotel.totalVacancy;

    const occupancyRate =
      hotel.totalRooms > 0
        ? Math.round((occupiedRooms / hotel.totalRooms) * 100)
        : 0;

    /* ======================================================
       5️⃣ FINAL RESPONSE (NOW CORRECT)
    ====================================================== */
    res.json({
      success: true,
      timeWindow: {
        last24HoursFrom: start,
        to: end,
      },
      stats: {
        totalFootfall: telecom.total + ticketDomestic + ticketInternational,

        domesticVisitors: telecom.domestic + ticketDomestic,

        internationalVisitors: telecom.international + ticketInternational,

        hotelOccupancy: occupancyRate,
      },
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.get("/debug/ticket-stats", async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const data = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: "$touristType",
          visitors: { $sum: "$visitors" },
        },
      },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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

    /* ================= BUILD MATCH CONDITIONS ================= */
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
        { $limit: 50 }, // ⛔ HARD CAP FOR PERFORMANCE
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

    /* ================= MERGE DATA ================= */
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
    const { state = "Rajasthan", district, search, limit = 6 } = req.query;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const telecomData = await TelecomFootfallAggregate.aggregate([
      {
        $match: {
          "location.state": new RegExp(`^${state}$`, "i"),
          "time_window.end": { $gte: since },
          confidence_score: { $gte: 0.5 },
        },
      },
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
    ]);

    const ticketData = await Ticket.aggregate([
      {
        $match: {
          state,
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: "$place",
          ticketFootfall: { $sum: "$visitors" },
        },
      },
    ]);

    const ticketMap = Object.fromEntries(
      ticketData.map((t) => [t._id, t.ticketFootfall])
    );

    const merged = telecomData.map((t) => {
      const ticketCount = ticketMap[t._id] || 0;

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

    const recommendations = merged
      .filter((p) => p.crowdCount >= 8000)
      .sort((a, b) => b.crowdCount - a.crowdCount)
      .slice(0, Number(limit));

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
    });
  } catch (err) {
    console.error("High crowd error:", err);
    res.status(500).json({ success: false });
  }
});

router.get("/hourly-crowd", async (req, res) => {
  try {
    const { state = "Rajasthan", district } = req.query;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const match = {
      "location.state": new RegExp(`^${state}$`, "i"),
      "time_window.end": { $gte: since },
      confidence_score: { $gte: 0.5 },
    };

    if (district) {
      match.$or = [
        { "location.district": new RegExp(district, "i") },
        { "location.city": new RegExp(district, "i") },
      ];
    }

    const data = await TelecomFootfallAggregate.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $hour: "$time_window.end" },
          avgCrowd: { $avg: "$footfall.total_devices" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          hour: "$_id",
          crowd: { $round: ["$avgCrowd", 0] },
        },
      },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.get("/crowd-summary", async (req, res) => {
  try {
    const { state = "Rajasthan", district, limit = 5 } = req.query;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const match = {
      "location.state": new RegExp(`^${state}$`, "i"),
      "time_window.end": { $gte: since },
    };

    if (district) {
      match.$or = [
        { "location.district": new RegExp(district, "i") },
        { "location.city": new RegExp(district, "i") },
      ];
    }

    const data = await TelecomFootfallAggregate.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$location.tourist_place",
          avgCrowd: { $avg: "$footfall.total_devices" },
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

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false });
  }
});

router.get("/best-visit-insights", async (req, res) => {
  res.json({
    success: true,
    bestTime: "8 AM – 10 AM",
    bestSeason: "October – March",
    recommendation:
      "Early mornings during winter offer the best experience with fewer crowds.",
  });
});

module.exports = router;
