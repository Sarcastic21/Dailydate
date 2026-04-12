const express = require("express");
const auth = require("../middleware/auth");
const User = require("../models/User");

const router = express.Router();

/**
 * POST /api/save-fcm-token
 * Body: { fcmToken: string | null } — null clears stored token
 */
router.post("/save-fcm-token", auth, async (req, res) => {
    try {
        const { fcmToken } = req.body;

        if (fcmToken != null && typeof fcmToken !== "string") {
            return res.status(400).json({ success: false, message: "Invalid fcmToken" });
        }

        const value =
            fcmToken && String(fcmToken).trim().length > 0 ? String(fcmToken).trim() : null;

        await User.findByIdAndUpdate(req.userId, { fcmToken: value });

        res.json({ success: true });
    } catch (err) {
        console.error("save-fcm-token:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

module.exports = router;
