const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { updateNotificationPreferences } = require("../services/notificationService");
const { hasPremiumAccess } = require("../services/subscription");

const router = express.Router();

router.get("/", auth, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        const currentUser = await User.findById(req.userId).select("accountType subscriptionExpiresAt blockedUsers");
        const isPremium = hasPremiumAccess(currentUser);
        const blockedUsers = currentUser.blockedUsers || [];
        const blockedUserIds = new Set(blockedUsers.map(id => String(id)));

        // Filter out notifications from blocked users
        const filteredNotifications = notifications.filter(n => {
            const senderId = n.data?.senderId || n.data?.viewerId;
            return !blockedUserIds.has(String(senderId));
        });

        if (!isPremium) {
            return res.json({ success: true, notifications: filteredNotifications });
        }

        // Identify unique IDs of users involved in locked notifications
        const uniqueUserIds = new Set();
        filteredNotifications.forEach(n => {
            if (n.data && (n.data.isLocked === 'true' || n.data.isLocked === true)) {
                const uid = n.data.senderId || n.data.viewerId;
                if (uid && mongoose.Types.ObjectId.isValid(uid)) {
                    uniqueUserIds.add(String(uid));
                }
            }
        });

        // Fetch user data in bulk
        const usersList = await User.find({
            _id: { $in: Array.from(uniqueUserIds) }
        }).select("name profilePhotos city state").lean();

        const userMap = {};
        usersList.forEach(u => {
            userMap[String(u._id)] = u;
        });

        // Process and un-redact notifications
        const processedNotifications = filteredNotifications.map(n => {
            if (!n.data || (!n.data.isLocked || n.data.isLocked === 'false')) return n;

            const d = n.data;
            const uid = d.senderId || d.viewerId;
            const realUser = userMap[String(uid)];

            if (!realUser) return n;

            // Use real data to rebuild
            const senderName = realUser.name;
            const senderPhoto = realUser.profilePhotos?.[0]?.url || d.senderPhoto || d.viewerPhoto;
            const city = realUser.city || d.senderCity || d.viewerCity;
            const state = realUser.state || d.senderState || d.viewerState;
            const locationStr = city ? `${city}, ${state || ''}` : (state || "");

            let title = n.title;
            let body = n.body;

            if (n.type === 'like') {
                title = `${senderName} liked you! ❤️`;
                body = `Check out their profile and start a conversation!`;
            } else if (n.type === 'view') {
                title = `${senderName} viewed your profile 👀`;
                body = locationStr ? `They are from ${locationStr}. Check them out!` : "Check out who's interested in you!";
            } else if (n.type === 'match') {
                title = "It's a Match! 💕";
                body = `${senderName} liked you back — start chatting!`;
            } else if (n.type === 'message') {
                title = `${senderName} messaged you 💬`;
                body = d.content || "You have a new message from them.";
            }

            return {
                ...n,
                title,
                body,
                data: {
                    ...d,
                    senderName, // Update metadata just in case
                    senderPhoto,
                    isLocked: 'false'
                }
            };
        });

        res.json({ success: true, notifications: processedNotifications });
    } catch (err) {
        console.error("notifications list:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

router.get("/unread-count", auth, async (req, res) => {
    try {
        const me = await User.findById(req.userId).select("blockedUsers");
        const blockedByMe = me?.blockedUsers || [];
        const blockedByThem = await User.find({ blockedUsers: req.userId }).select("_id").lean();
        const theyBlockedMe = blockedByThem.map(u => String(u._id));
        const allExclusions = [...blockedByMe.map(id => String(id)), ...theyBlockedMe];

        const count = await Notification.countDocuments({ 
            userId: req.userId, 
            read: false,
            "data.senderId": { $nin: allExclusions }
        });
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

router.get("/unread-breakdown", auth, async (req, res) => {
    try {
        const me = await User.findById(req.userId).select("blockedUsers");
        const blockedByMe = me?.blockedUsers || [];
        const blockedByThem = await User.find({ blockedUsers: req.userId }).select("_id").lean();
        const theyBlockedMe = blockedByThem.map(u => String(u._id));
        const allExclusions = [...blockedByMe.map(id => String(id)), ...theyBlockedMe];

        const counts = await Notification.aggregate([
            { 
                $match: { 
                    userId: new mongoose.Types.ObjectId(req.userId), 
                    read: false,
                    "data.senderId": { $nin: allExclusions }
                } 
            },
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
