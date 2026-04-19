const express = require("express");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const Match = require("../models/Match");
const UserAction = require("../models/UserAction");
const Report = require("../models/Report");
const auth = require("../middleware/auth");
const { hasPremiumAccess } = require("../services/subscription");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { emitToUserSockets } = require("../utils/socketEmit");

const router = express.Router();

// Get messages for a match
router.get("/messages/:matchId", auth, async (req, res) => {
    try {
        const { matchId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = 30;
        const skip = (page - 1) * limit;

        const [messages, match] = await Promise.all([
            Message.find({ matchId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("senderId", "name profilePhotos"),
            Match.findById(matchId).select("isApproved user1Id user2Id")
                .populate("user1Id", "name profilePhotos isOnline photo")
                .populate("user2Id", "name profilePhotos isOnline photo")
        ]);

        if (!match) return res.status(404).json({ message: "Match not found", success: false });

        // Mark messages as read
        await Message.updateMany(
            { matchId, receiverId: req.userId, "readStatus.read": false },
            { "readStatus.read": true, "readStatus.readAt": new Date() }
        );

        res.json({
            success: true,
            messages: messages.reverse(),
            isApproved: match?.isApproved || false,
            matchDetails: match
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// Approve a chat
router.post("/approve/:matchId", auth, async (req, res) => {
    try {
        const { matchId } = req.params;
        const match = await Match.findById(matchId);
        if (!match) return res.status(404).json({ success: false, message: "Match not found" });

        match.isApproved = true;
        await match.save();

        res.json({ success: true, message: "Chat approved" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Get all conversations for current user
router.get("/conversations", auth, async (req, res) => {
    try {
        const userId = req.userId;

        // Get all matches for this user (except blocked)
        const matches = await Match.find({
            $or: [{ user1Id: userId }, { user2Id: userId }],
            status: { $ne: "blocked" },
        }).populate("user1Id", "name profilePhotos lastActive isOnline")
            .populate("user2Id", "name profilePhotos lastActive isOnline")
            .sort({ updatedAt: -1 });

        const conversationsWithMessages = await Promise.all(matches.map(async (match) => {
            if (!match.user1Id || !match.user2Id) return null;

            const otherUser =
                match.user1Id._id.toString() === userId.toString()
                    ? match.user2Id
                    : match.user1Id;

            // Get last message content dynamically
            const lastMessage = await Message.findOne({ matchId: match._id })
                .sort({ createdAt: -1 })
                .select("content senderId createdAt");

            // Requirement: Only show matches that have at least one message AND at least one message was sent by a premium user.
            if (!lastMessage) return null;

            const senderId = lastMessage.senderId;
            const senderDoc = await User.findById(senderId).select("accountType subscriptionExpiresAt userType");
            const receiverDoc = await User.findById(otherUser._id).select("accountType subscriptionExpiresAt userType");

            const isSenderPremium = hasPremiumAccess(senderDoc);
            const isReceiverPremium = hasPremiumAccess(receiverDoc);
            const isBotInvolved = senderDoc?.userType === "bot" || receiverDoc?.userType === "bot";

            // If neither the sender nor the recipient is premium, hide the chat (standard free match with no premium initiator)
            // EXCEPT if a bot is involved, we show it to provide engagement.
            if (!isSenderPremium && !isReceiverPremium && !isBotInvolved) return null;

            return {
                matchId: match._id,
                user: {
                    id: otherUser._id,
                    name: otherUser.name || "User",
                    photo: otherUser.profilePhotos?.[0]?.url || "https://via.placeholder.com/150",
                    isOnline: otherUser.isOnline,
                },
                lastMessage: {
                    content: lastMessage.content,
                    senderId: lastMessage.senderId,
                    createdAt: lastMessage.createdAt
                },
                matchedAt: match.matchedAt,
                isApproved: match.isApproved,
                // Sort by last message time (most recent first)
                sortTime: lastMessage.createdAt.getTime()
            };
        }));

        // Filter out nulls and sort by last message time (newest first)
        const validConversations = conversationsWithMessages.filter(item => item !== null);
        validConversations.sort((a, b) => b.sortTime - a.sortTime);
        
        // Remove sortTime before sending to client
        const result = validConversations.map(({ sortTime, ...rest }) => rest);

        res.json({ success: true, conversations: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error", success: false });
    }
});

router.get("/unread-total", auth, async (req, res) => {
    try {
        const me = await User.findById(req.userId).select("blockedUsers");
        const blockedByMe = me?.blockedUsers || [];

        // Also exclude users who have blocked me
        const blockedByThem = await User.find({ blockedUsers: req.userId }).select("_id").lean();
        const theyBlockedMe = blockedByThem.map(u => u._id);

        const allExclusions = [...blockedByMe, ...theyBlockedMe];

        const result = await Message.aggregate([
            {
                $match: {
                    receiverId: new mongoose.Types.ObjectId(String(req.userId)),
                    "readStatus.read": false,
                    senderId: { $nin: allExclusions.map(id => new mongoose.Types.ObjectId(String(id))) }
                }
            },
            {
                $group: {
                    _id: "$senderId"
                }
            },
            {
                $count: "unreadConversations"
            }
        ]);

        const count = result.length > 0 ? result[0].unreadConversations : 0;
        res.json({ success: true, count });
    } catch (err) {
        console.error("unread-total error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Block a user in chat
router.post("/block/:matchId", auth, async (req, res) => {
    try {
        const { matchId } = req.params;
        const userId = req.userId;

        const match = await Match.findById(matchId);
        if (!match) return res.status(404).json({ success: false, message: "Match not found" });

        // Verify user is part of match
        if (String(match.user1Id) !== String(userId) && String(match.user2Id) !== String(userId)) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const targetId = String(match.user1Id) === String(userId) ? match.user2Id : match.user1Id;

        // 1. Update match status
        match.status = "blocked";
        await match.save();

        // 2. Add to UserAction for discovery filtering
        await UserAction.findOneAndUpdate(
            { userId, targetUserId: targetId, actionType: "block" },
            { userId, targetUserId: targetId, actionType: "block", timestamp: new Date() },
            { upsert: true }
        );

        // 3. Update User model's blockedUsers array for the list view
        await User.findByIdAndUpdate(userId, {
            $addToSet: { blockedUsers: targetId }
        });

        // 4. Mark all unread messages/notifications as read between them
        await Promise.all([
            Message.updateMany(
                { matchId: match._id, receiverId: targetId, "readStatus.read": false },
                { "readStatus.read": true, "readStatus.readAt": new Date() }
            ),
            Message.updateMany(
                { matchId: match._id, receiverId: userId, "readStatus.read": false },
                { "readStatus.read": true, "readStatus.readAt": new Date() }
            ),
            Notification.updateMany(
                { userId: targetId, read: false, "data.senderId": String(userId) },
                { read: true }
            ),
            Notification.updateMany(
                { userId: userId, read: false, "data.senderId": String(targetId) },
                { read: true }
            )
        ]);

        // 5. Emit countsUpdate to both parties so badge refreshes
        const io = req.app.get("io");
        const redisClient = req.app.get("redisClient");
        await Promise.all([
            emitToUserSockets(io, redisClient, userId, "countsUpdate", { source: "block" }),
            emitToUserSockets(io, redisClient, targetId, "countsUpdate", { source: "blocked" })
        ]);

        res.json({ success: true, message: "User blocked" });
    } catch (err) {
        console.error("Block error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Report and block a user
router.post("/report/:matchId", auth, async (req, res) => {
    try {
        const { matchId } = req.params;
        const { reason } = req.body;
        const userId = req.userId;

        const match = await Match.findById(matchId);
        if (!match) return res.status(404).json({ success: false, message: "Match not found" });

        const targetId = String(match.user1Id) === String(userId) ? match.user2Id : match.user1Id;

        // 1. Create report
        await Report.create({
            reporterId: userId,
            reportedId: targetId,
            matchId,
            reason: reason || "No reason provided"
        });

        // 2. Block the user as well
        match.status = "blocked";
        await match.save();

        await UserAction.findOneAndUpdate(
            { userId, targetUserId: targetId, actionType: "block" },
            { userId, targetUserId: targetId, actionType: "block", timestamp: new Date() },
            { upsert: true }
        );

        // 3. Update User model's blockedUsers array for the list view
        await User.findByIdAndUpdate(userId, {
            $addToSet: { blockedUsers: targetId }
        });

        res.json({ success: true, message: "User reported and blocked" });
    } catch (err) {
        console.error("Report error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

module.exports = router;
