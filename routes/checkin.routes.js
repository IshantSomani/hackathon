const express = require("express");
const router = express.Router();
const EntryEvent = require("../models/EntryEvent");
router.post("/checkin", async (req, res) => {
  try {
    const {
      locationId,
      visitorType,
      geoOptedIn = false,
      geoLocation,
    } = req.body;

    /* ================= VALIDATION ================= */
    if (!locationId || !visitorType) {
      return res.status(400).json({
        success: false,
        message: "locationId and visitorType are required",
      });
    }

    if (!["domestic", "international"].includes(visitorType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid visitorType",
      });
    }

    if (geoOptedIn && !geoLocation) {
      return res.status(400).json({
        success: false,
        message: "geoLocation required if geoOptedIn is true",
      });
    }

    /* ================= CREATE EVENT ================= */
    const event = await EntryEvent.create({
      locationId,
      visitorType,
      geoOptedIn,
      geoLocation: geoOptedIn ? geoLocation : null,
      createdAt: new Date(),
    });

    /* ================= RESPONSE ================= */
    return res.status(201).json({
      success: true,
      eventId: event._id,
      timestamp: event.createdAt,
    });
  } catch (err) {
    console.error("Check-in error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to record check-in",
    });
  }
});

module.exports = router;
