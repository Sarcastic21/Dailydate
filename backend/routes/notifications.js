const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { updateNotificationPreferences } = require("../services/notificationService");

const router = express.Router();

router.get("/", auth, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
        res.json({ success: true, notifications });
    } catch (err) {
        console.error("notifications list:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

router.get("/unread-count", auth, async (req, res) => {
    try {
        const count = await Notification.countDocuments({ userId: req.userId, read: false });
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

router.get("/unread-breakdown", auth, async (req, res) => {
    try {
        const counts = await Notification.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.userId), read: false } },
            { $group: { _id: "$type", count: { $sum: 1 } } }
        ]);

        const breakdown = {
            like: 0,
            view: 0,
            match: 0,
            message: 0
        };

        counts.forEach(c => {
            if (breakdown.hasOwnProperty(c._id)) {
                breakdown[c._id] = c.count;
            }
        });

        res.json({ success: true, breakdown });
    } catch (err) {
        console.error("unread breakdown error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

router.patch("/:id/read", auth, async (req, res) => {
    try {
        const result = await Notification.updateOne(
            { _id: req.params.id, userId: req.userId },
            { read: true }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: "Not found" });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

router.post("/read-all", auth, async (req, res) => {
    try {
        await Notification.updateMany({ userId: req.userId, read: false }, { read: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

router.post("/read-by-type", auth, async (req, res) => {
    try {
        const { type } = req.body;
        if (!type) return res.status(400).json({ success: false, message: "Type required" });

        await Notification.updateMany(
            { userId: req.userId, type, read: false },
            { read: true }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Get user notification preferences
router.get("/preferences", auth, async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId).select("notificationPreferences");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        res.json({
            success: true,
            preferences: user.notificationPreferences || {
                messages: true,
                likes: true,
                views: true,
                matches: true,
                email: false,
            },
        });
    } catch (error) {
        console.error("[Notification Preferences GET] Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch notification preferences",
        });
    }
});

// Update user notification preferences
router.put("/preferences", auth, async (req, res) => {
    try {
        const userId = req.userId;
        const { preferences } = req.body;

        // Validate preferences
        const validPreferences = {
            messages: Boolean(preferences?.messages),
            likes: Boolean(preferences?.likes),
            views: Boolean(preferences?.views),
            matches: Boolean(preferences?.matches),
            email: Boolean(preferences?.email),
        };

        const success = await updateNotificationPreferences(userId, validPreferences);
        if (success) {
            res.json({
                success: true,
                message: "Notification preferences updated",
                preferences: validPreferences,
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Failed to update notification preferences",
            });
        }
    } catch (error) {
        console.error("[Notification Preferences Update] Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update notification preferences",
        });
    }
});

module.exports = router;
