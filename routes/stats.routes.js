const express = require("express");
const router = express.Router();
const TelecomFootfallAggregate = require("../models/TelecomFootfallAggregate");
const Hotel = require("../models/hotels");

/**
 * 🔹 GET /dashboard/stats
 * Optimized dashboard KPIs (Telecom + Hotels)
 */
router.get("/stats", async (req, res) => {
  try {
    /* ======================================================
       1️⃣ FIND LATEST TELECOM TIMESTAMP (FAST & INDEXED)
    ====================================================== */
    const latestRecord = await TelecomFootfallAggregate.findOne()
      .sort({ "time_window.start": -1 })
      .select("time_window.start")
      .lean();

    let visitors = {
      totalVisitors: 0,
      domesticVisitors: 0,
      internationalVisitors: 0,
    };

    if (latestRecord) {
      const end = latestRecord.time_window.start;
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // last 24 hours

      /* ======================================================
         2️⃣ VISITOR AGGREGATION (LAST 24H ONLY)
      ====================================================== */
      const visitorAgg = await TelecomFootfallAggregate.aggregate([
        {
          $match: {
            "time_window.start": { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            totalVisitors: { $sum: "$footfall.total_devices" },
            domesticVisitors: { $sum: "$footfall.domestic_devices" },
            internationalVisitors: {
              $sum: "$footfall.international_devices",
            },
          },
        },
      ]);

      if (visitorAgg.length > 0) {
        visitors = visitorAgg[0];
      }
    }

    /* ======================================================
       3️⃣ HOTEL OCCUPANCY AGGREGATION
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
       4️⃣ FINAL RESPONSE
    ====================================================== */
    res.json({
      success: true,
      timeWindow: latestRecord
        ? {
            last24HoursFrom: new Date(
              latestRecord.time_window.start.getTime() - 24 * 60 * 60 * 1000
            ),
            to: latestRecord.time_window.start,
          }
        : null,
      stats: {
        totalFootfall: visitors.totalVisitors || 0,
        domesticVisitors: visitors.domesticVisitors || 0,
        internationalVisitors: visitors.internationalVisitors || 0,
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

module.exports = router;
