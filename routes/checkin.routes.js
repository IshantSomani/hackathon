const express = require("express");
const router = express.Router();
const EntryEvent = require("../models/EntryEvent");

router.post("/checkin", async (req, res) => {
  try {
    const event = await EntryEvent.create({
      locationId: req.body.locationId,
      visitorType: req.body.visitorType,
      geoOptedIn: req.body.geoOptedIn,
      geoLocation: req.body.geoLocation || null,
    });

    res.status(201).json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
