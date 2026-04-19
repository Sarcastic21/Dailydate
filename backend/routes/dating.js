const express = require("express");
const User = require("../models/User");
const Match = require("../models/Match");
const UserAction = require("../models/UserAction");
const ProfileView = require("../models/ProfileView");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const auth = require("../middleware/auth");
const { emitToUserSockets } = require("../utils/socketEmit");
const { hasActiveSocket } = require("../utils/socketPresence");
const { sendChatMessagePush } = require("./../services/fcmPush");
const { createNotification } = require("../services/notificationService");
const {
    ensureUsageDay,
    canLike,
    hasPremiumAccess,
    buildSubscriptionPayload,
} = require("../services/subscription");
const botInteractionService = require("../services/botInteractionService");

const router = express.Router();

const calculateAge = (fullDate) => {
    if (!fullDate) return null;
    const diff = Date.now() - new Date(fullDate).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
};

/** Non-premium users get shape-only previews (no PII) for Interactions UI */
function redactInteractionRows(items, tab) {
    return items.map((item, i) => ({
        locked: true,
        id: item.id || `preview-${tab}-${i}`,
        matchId: tab === "matches" ? item.matchId : undefined,
        name: "Someone",
        photo: item.photo || null,
        age: item.age || null,
        isOnline: item.isOnline || false,
        state: item.state || "",
        city: item.city || "",
        timestamp: item.timestamp,
    }));
}



// ─── DISCOVER ───────────────────────────────────────────────
router.get("/discover", auth, async (req, res) => {
    try {
        const userId = req.userId;
        const requestedState = req.query.state;
        const limit = parseInt(req.query.limit) || 20;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;

        // Parallel queries for better performance
        const [user, interacted, blockedBy] = await Promise.all([
            User.findById(userId),
            UserAction.find({
                userId,
                actionType: { $in: ["like", "skip", "block"] },
            }).distinct("targetUserId"),
            UserAction.find({
                targetUserId: userId,
                actionType: "block",
            }).distinct("userId")
        ]);

        const excluded = [...interacted.map(String), ...blockedBy.map(String), String(userId)];

        const query = {
            _id: { $nin: excluded },
        };

        if (user.lookingFor === "male") {
            query.gender = "male";
        } else if (user.lookingFor === "female") {
            query.gender = "female";
        } else if (user.lookingFor === "everyone") {
            query.gender = { $in: ["male", "female", "non-binary"] };
        } else {
            // Default fallback for users who haven't set preferences
            if (user.gender === "male") {
                query.gender = "female";
            } else if (user.gender === "female") {
                query.gender = "male";
            } else {
                // For non-binary users with no preference, or any other case, show all
                query.gender = { $in: ["male", "female", "non-binary"] };
            }
        }

        if (user.ageRange) {
            const now = new Date();
            const minBirth = new Date(now.getFullYear() - user.ageRange.max, now.getMonth(), now.getDate());
            const maxBirth = new Date(now.getFullYear() - user.ageRange.min, now.getMonth(), now.getDate());
            query["dateOfBirth.fullDate"] = { $gte: minBirth, $lte: maxBirth };
        }

        // Only show verified users who are NOT deactivated and NOT pending deletion
        query.isVerified = true;
        query.isDeactivated = { $ne: true };
        query.deletionRequestedAt = null;

        const isExplicitState = !!req.query.state;

        let users;
        if (!isExplicitState) {
            /** 
             * "Anywhere" mode: 
             * In paginated mode, we still want variety. 
             * Simple skip/limit might show the same people in different orders if not sorted.
             * For now, we sort by lastActive to keep it relatively stable across pages.
             */
            users = await User.find(query)
                .select("name profilePhotos dateOfBirth gender bio lastActive state city isOnline intention lookingFor")
                .sort({ lastActive: -1 })
                .skip(skip)
                .limit(limit);
        } else {
            // Explicit state mode: Filter strictly by requested state
            query.state = { $regex: new RegExp("^" + requestedState + "$", "i") };

            users = await User.find(query)
                .select("name profilePhotos dateOfBirth gender bio lastActive state city isOnline intention lookingFor")
                .sort({ isOnline: -1, lastActive: -1 })
                .skip(skip)
                .limit(limit);
        }

        let noResultsInState = false;

        // Fallback logic: Only fallback if results are low AND no specific state was requested.
        // If a user explicitly selects a state in the picker, we should show only that state.
        if (users.length === 0 && !isExplicitState && requestedState && page === 1) {
            noResultsInState = true;
            delete query.state;
            users = await User.find(query)
                .select("name profilePhotos dateOfBirth gender bio lastActive state city isOnline intention lookingFor")
                .sort({ isOnline: -1, lastActive: -1 })
                .skip(skip)
                .limit(limit);
        } else if (users.length === 0 && isExplicitState && page === 1) {
            noResultsInState = true;
        }

        const formatted = users.map((u) => ({
            id: u._id,
            name: u.name,
            age: calculateAge(u.dateOfBirth?.fullDate),
            photos: u.profilePhotos,
            bio: u.bio,
            isOnline: u.isOnline,
            state: u.state,
            city: u.city,
            intention: u.intention,
            gender: u.gender,
            lookingFor: u.lookingFor,
        }));

        res.json({ 
            success: true, 
            users: formatted, 
            noResultsInState,
            hasMore: formatted.length === limit,
            page: page
        });
    } catch (err) {
        console.error("Discover error:", err);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── LIKE ────────────────────────────────────────────────────
router.post("/like/:targetId", auth, async (req, res) => {
    try {
        const userId = req.userId;
        const targetId = req.params.targetId;

        if (String(userId) === targetId)
            return res.status(400).json({ message: "Cannot like yourself", success: false });

        const [priorLike, liker] = await Promise.all([
            UserAction.findOne({
                userId,
                targetUserId: targetId,
                actionType: "like",
            }),
            User.findById(userId)
        ]);

        if (priorLike) {
            return res.json({
                success: true,
                message: "Already liked",
                isMatch: false,
                alreadyLiked: true,
            });
        }

        if (!liker) return res.status(404).json({ success: false, message: "User not found" });
        await ensureUsageDay(liker);
        const likeCheck = canLike(liker);
        if (!likeCheck.ok) {
            return res.status(403).json({
                success: false,
                code: likeCheck.code,
                message: likeCheck.message,
            });
        }

        await Promise.all([
            UserAction.findOneAndUpdate(
                { userId, targetUserId: targetId, actionType: "like" },
                { userId, targetUserId: targetId, actionType: "like", timestamp: new Date() },
                { upsert: true }
            ),
            User.findByIdAndUpdate(targetId, { $inc: { "stats.totalLikes": 1 } })
        ]);

        liker.usageDaily.likesUsed = (liker.usageDaily.likesUsed || 0) + 1;
        await liker.save();

        // Check mutual like
        const mutual = await UserAction.findOne({
            userId: targetId,
            targetUserId: userId,
            actionType: "like",
        });

        let matchId = null;
        /** Only toast "new match" when mutual match is created or upgraded in this request */
        let notifyNewMatch = false;
        if (mutual) {
            const existing = await Match.findOne({
                $or: [
                    { user1Id: userId, user2Id: targetId },
                    { user1Id: targetId, user2Id: userId },
                ],
            });

            if (!existing) {
                const match = await Match.create({
                    user1Id: userId,
                    user2Id: targetId,
                    status: "matched",
                    matchedAt: new Date(),
                    mutualMatch: true,
                    isApproved: true, // Mutual match is pre-approved
                    action: { user1Action: "like", user2Action: "like" },
                });
                matchId = match._id;
                notifyNewMatch = true;
                await User.findByIdAndUpdate(userId, { $inc: { "stats.totalMatches": 1 } });
                await User.findByIdAndUpdate(targetId, { $inc: { "stats.totalMatches": 1 } });
            } else {
                matchId = existing._id;
                if (!existing.mutualMatch) {
                    existing.status = "matched";
                    existing.mutualMatch = true;
                    existing.isApproved = true; // Upgraded match is pre-approved
                    existing.matchedAt = new Date();
                    await existing.save();

                    notifyNewMatch = true;
                    await User.findByIdAndUpdate(userId, { $inc: { "stats.totalMatches": 1 } });
                    await User.findByIdAndUpdate(targetId, { $inc: { "stats.totalMatches": 1 } });
                }
            }
        }

        res.json({
            success: true,
            message: mutual ? "It's a match! 💕" : "Liked!",
            isMatch: !!mutual,
            matchId,
        });

        // Notify target: socket only when they have an active session; otherwise DB + FCM
        try {
            const io = req.app.get("io");
            const redisClient = req.app.get("redisClient");
            const sender = await User.findById(userId).select("name profilePhotos");
            const targetUser = await User.findById(targetId).select("accountType subscriptionExpiresAt");
            const isTargetPremium = hasPremiumAccess(targetUser);

            const senderName = sender?.name || "Someone";
            const senderPhoto = sender?.profilePhotos?.[0]?.url;

            const title = notifyNewMatch
                ? (isTargetPremium ? "It's a Match! with " + senderName + "!  " : "Someone matched with you!  ")
                : (isTargetPremium ? `${senderName} liked you! ` : "Someone liked you! ");
            const body = notifyNewMatch
                ? (isTargetPremium ? `You and ${senderName} are a perfect pair!` : "Someone liked you back! Check out who it is!")
                : (isTargetPremium ? "Check out their profile now!" : "Upgrade to see who liked you!");

            const targetOnline = await hasActiveSocket(redisClient, targetId);

            // Always create notification to ensure unread counts work in DB
            await createNotification(targetId, notifyNewMatch ? "match" : "like", title, body, {
                type: notifyNewMatch ? "match" : "like",
                senderId: String(userId),
                senderName,
                senderPhoto,
                senderCity: me ? me.city : "",
                senderState: me ? me.state : "",
                matchId: matchId ? String(matchId) : "",
                isLocked: !isTargetPremium,
            });

            if (targetOnline) {
                if (notifyNewMatch && matchId) {
                    await emitToUserSockets(io, redisClient, targetId, "newMatch", {
                        senderId: userId,
                        senderName,
                        senderPhoto,
                        matchId: matchId || undefined,
                        isLocked: !isTargetPremium,
                    });
                } else if (!mutual) {
                    await emitToUserSockets(io, redisClient, targetId, "newLike", {
                        senderId: userId,
                        senderName,
                        senderPhoto,
                        matchId: matchId || undefined,
                        isMatch: false,
                        isLocked: !isTargetPremium,
                    });
                }
            }
        } catch (e) {
            console.error("Like socket notify:", e.message);
        }

        // --- REACTIVE BOT LOGIC ---
        if (targetUser && targetUser.userType === "bot") {
            // Schedule reactive responses (view/like/message) based on gender
            botInteractionService.handleReactiveEngagement(userId, targetId);
        }
        // --------------------------

    } catch (err) {
        console.error("Like error:", err);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── SKIP ────────────────────────────────────────────────────
router.post("/skip/:targetId", auth, async (req, res) => {
    try {
        await UserAction.findOneAndUpdate(
            { userId: req.userId, targetUserId: req.params.targetId, actionType: "skip" },
            { userId: req.userId, targetUserId: req.params.targetId, actionType: "skip", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
            { upsert: true }
        );
        res.json({ success: true, message: "Skipped" });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── GET MATCHES ─────────────────────────────────────────────
router.get("/matches", auth, async (req, res) => {
    try {
        const userId = req.userId;
        const matches = await Match.find({
            $or: [{ user1Id: userId }, { user2Id: userId }],
            status: "matched",
            mutualMatch: { $ne: false },
        })
            .populate("user1Id", "name profilePhotos lastActive isOnline dateOfBirth gender state city intention lookingFor isDeactivated deletionRequestedAt")
            .populate("user2Id", "name profilePhotos lastActive isOnline dateOfBirth gender state city intention lookingFor isDeactivated deletionRequestedAt")
            .sort({ matchedAt: -1 });

        // Filter out matches where the other user is deactivated or pending deletion
        const activeMatches = matches.filter((m) => {
            const other = String(m.user1Id._id) === String(userId) ? m.user2Id : m.user1Id;
            return !other.isDeactivated && !other.deletionRequestedAt;
        });

        const formatted = activeMatches.map((m) => {
            const other = String(m.user1Id._id) === String(userId) ? m.user2Id : m.user1Id;
            const calculateAge = (fullDate) => {
                if (!fullDate) return null;
                return Math.floor(Date.now() - new Date(fullDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
            };
            return {
                matchId: m._id,
                user: {
                    id: other._id,
                    name: other.name,
                    photo: other.profilePhotos?.[0]?.url || null,
                    isOnline: other.isOnline,
                    gender: other.gender,
                    age: calculateAge(other.dateOfBirth?.fullDate),
                    state: other.state,
                    city: other.city,
                    intention: other.intention,
                    lookingFor: other.lookingFor,
                },
                matchedAt: m.matchedAt,
                hasBotRevisited: m.hasBotRevisited || false,
                lastMessageAt: m.lastMessageAt,
            };
        });

        res.json({ success: true, matches: formatted });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── GET INTERACTIONS (Likes, Matches, Views) ────────────────
router.get("/interactions", auth, async (req, res) => {
    try {
        const userId = req.userId;

        const me = await User.findById(userId);
        const blockedUsers = me?.blockedUsers || [];

        // Parallel queries for better performance
        const [likesReceived, profileViews, matches] = await Promise.all([
            UserAction.find({ 
                targetUserId: userId, 
                actionType: "like",
                userId: { $nin: blockedUsers } 
            })
                .populate("userId", "name profilePhotos lastActive state city gender bio dateOfBirth isOnline")
                .sort({ timestamp: -1 })
                .limit(50),
            ProfileView.find({ 
                targetUserId: userId,
                viewerId: { $nin: blockedUsers } 
            })
                .populate("viewerId", "name profilePhotos lastActive state city gender bio dateOfBirth isOnline")
                .sort({ viewedAt: -1 })
                .limit(50),
            Match.find({
                $or: [{ user1Id: userId }, { user2Id: userId }],
                status: "matched",
                mutualMatch: { $ne: false },
                user1Id: { $nin: blockedUsers },
                user2Id: { $nin: blockedUsers }
            })
                .populate("user1Id", "name profilePhotos lastActive state city gender bio dateOfBirth isOnline")
                .populate("user2Id", "name profilePhotos lastActive state city gender bio dateOfBirth isOnline")
                .sort({ matchedAt: -1 })
                .limit(50)
        ]);

        const formattedLikes = likesReceived.map(l => ({
            id: l.userId._id,
            name: l.userId.name,
            photo: l.userId.profilePhotos?.[0]?.url || "https://via.placeholder.com/150",
            age: calculateAge(l.userId.dateOfBirth?.fullDate),
            isOnline: l.userId.isOnline,
            state: l.userId.state,
            city: l.userId.city,
            gender: l.userId.gender,
            timestamp: l.timestamp
        }));

        const formattedViews = profileViews.map(v => ({
            id: v.viewerId._id,
            name: v.viewerId.name,
            photo: v.viewerId.profilePhotos?.[0]?.url || "https://via.placeholder.com/150",
            age: calculateAge(v.viewerId.dateOfBirth?.fullDate),
            isOnline: v.viewerId.isOnline,
            state: v.viewerId.state,
            city: v.viewerId.city,
            gender: v.viewerId.gender,
            timestamp: v.viewedAt
        }));

        const formattedMatches = matches.map(m => {
            const other = String(m.user1Id._id) === String(userId) ? m.user2Id : m.user1Id;
            return {
                matchId: m._id,
                id: other._id,
                name: other.name,
                photo: other.profilePhotos?.[0]?.url || "https://via.placeholder.com/150",
                age: calculateAge(other.dateOfBirth?.fullDate),
                isOnline: other.isOnline,
                state: other.state,
                city: other.city,
                gender: other.gender,
                timestamp: m.matchedAt
            };
        });

        if (!hasPremiumAccess(me)) {
            return res.json({
                success: true,
                lockedPreview: true,
                likes: redactInteractionRows(formattedLikes, "likes"),
                views: redactInteractionRows(formattedViews, "views"),
                matches: redactInteractionRows(formattedMatches, "matches"),
            });
        }

        res.json({
            success: true,
            lockedPreview: false,
            likes: formattedLikes,
            views: formattedViews,
            matches: formattedMatches
        });
    } catch (err) {
        console.error("Interactions error:", err);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── UNMATCH ─────────────────────────────────────────────────
router.delete("/unmatch/:matchId", auth, async (req, res) => {
    try {
        await Match.findByIdAndDelete(req.params.matchId);
        res.json({ success: true, message: "Unmatched" });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── GET USER PROFILE & RECORD VIEW ─────────────────────────
router.get("/user/:userId", auth, async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const userId = req.userId;

        const [targetUser, currentUser] = await Promise.all([
            User.findById(targetUserId).select("name profilePhotos dateOfBirth gender bio stats lastActive state city isOnline intention lookingFor personality lifestyle physical beliefs accountType subscriptionExpiresAt isVerified blockedUsers"),
            User.findById(userId).select("blockedUsers")
        ]);

        if (!targetUser) return res.status(404).json({ message: "Not found", success: false });

        // Security Guard: Check if blocked (either way)
        const myBlocked = currentUser?.blockedUsers || [];
        const theirBlocked = targetUser?.blockedUsers || [];
        if (myBlocked.includes(targetUserId) || theirBlocked.includes(userId)) {
            return res.status(403).json({ message: "Access restricted", success: false, code: "BLOCKED" });
        }

        const user = targetUser;

        let recordedNewProfileView = false;
        // Record a view if not viewing self
        if (String(userId) !== String(targetUserId)) {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const recentView = await ProfileView.findOne({
                viewerId: userId,
                targetUserId,
                viewedAt: { $gte: oneHourAgo }
            });

            if (!recentView) {
                await ProfileView.create({ viewerId: userId, targetUserId });
                await User.findByIdAndUpdate(targetUserId, { $inc: { "stats.profileViews": 1 } });
                recordedNewProfileView = true;
            }
        }

        const hasLiked = await UserAction.exists({
            userId,
            targetUserId,
            actionType: "like"
        });
        const isMatch = await Match.exists({
            $or: [
                { user1Id: userId, user2Id: targetUserId },
                { user1Id: targetUserId, user2Id: userId }
            ]
        });

        const age = calculateAge(user.dateOfBirth?.fullDate);
        const tier = user.subscription?.effectiveTier || user.accountType || 'normal';
        const isPremium = tier === 'gold';

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                photos: user.profilePhotos,
                age: age,
                gender: user.gender,
                bio: user.bio,
                stats: user.stats,
                isOnline: user.isOnline,
                state: user.state,
                city: user.city,
                intention: user.intention,
                lookingFor: user.lookingFor,
                dateOfBirth: user.dateOfBirth,
                personality: user.personality,
                lifestyle: user.lifestyle,
                physical: user.physical,
                beliefs: user.beliefs,
                hasLiked: Boolean(hasLiked),
                isMatch: Boolean(isMatch),
                subscription: buildSubscriptionPayload(user),
                accountType: user.accountType,
                isPremium: hasPremiumAccess(user),
                isVerified: user.isVerified || false
            },
        });

        // Notify once per new recorded view (not on every profile refresh within the hour)
        if (recordedNewProfileView) {
            try {
                const io = req.app.get("io");
                const redisClient = req.app.get("redisClient");
                const viewer = await User.findById(userId).select("name profilePhotos");
                const targetUser = await User.findById(targetUserId).select("accountType subscriptionExpiresAt");
                const isTargetPremium = hasPremiumAccess(targetUser);

                const viewerName = isTargetPremium ? (viewer?.name || "Someone") : "Someone";
                const viewerPhoto = viewer?.profilePhotos?.[0]?.url;

                const viewTitle = isTargetPremium ? `${viewerName} viewed you! 👀` : "Profile viewed 👀";
                const viewBody = isTargetPremium ? "They checked you out!" : "Someone viewed your profile. Upgrade to see who.";
                const viewPayload = {
                    viewerId: userId,
                    viewerName,
                    viewerPhoto,
                    isLocked: !isTargetPremium,
                };

                const targetOnline = await hasActiveSocket(redisClient, targetUserId);

                // Always create notification to ensure unread counts work in DB
                await createNotification(targetUserId, "view", viewTitle, viewBody, {
                    type: "view", ...viewPayload
                });

                if (targetOnline) {
                    await emitToUserSockets(io, redisClient, targetUserId, "newView", viewPayload);
                }
                // FCM push is already sent inside createNotification above
            } catch (e) {
                console.error("Profile view socket notify:", e.message);
            }
        }
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── GET ONLINE USERS DIRECTORY ─────────────────────────────
router.get("/online-users", auth, async (req, res) => {
    try {
        const [me, blockedByThem] = await Promise.all([
            User.findById(req.userId).select("gender lookingFor blockedUsers"),
            UserAction.find({ targetUserId: req.userId, actionType: "block" }).distinct("userId")
        ]);

        if (!me) return res.status(404).json({ success: false, message: "User not found" });

        const myBlocked = me.blockedUsers || [];
        const ignored = [...myBlocked.map(id => String(id)), ...blockedByThem.map(id => String(id)), String(req.userId)];
        
        // Exclude blocked users, deactivated users, and users pending deletion
        const query = {
            _id: { $nin: ignored },
            isDeactivated: { $ne: true },
            deletionRequestedAt: null
        };

        if (me.gender === "male") query.gender = "female";
        else if (me.gender === "female") query.gender = "male";
        else if (me.lookingFor && me.lookingFor !== "everyone") query.gender = me.lookingFor;

        const users = await User.find(query)
            .select("name profilePhotos lastActive bio gender state city isOnline createdAt intention lookingFor isVerified accountType subscriptionExpiresAt")
            .sort({ lastActive: -1 })
            .limit(1000);

        const formatted = users.map(u => ({
            id: u._id,
            name: u.name,
            photo: u.profilePhotos?.[0]?.url || "https://via.placeholder.com/150",
            photos: u.profilePhotos,
            bio: u.bio,
            isOnline: u.isOnline,
            lastActive: u.lastActive,
            state: u.state,
            city: u.city,
            createdAt: u.createdAt,
            intention: u.intention,
            lookingFor: u.lookingFor,
            gender: u.gender,
            isVerified: u.isVerified || false,
            accountType: u.accountType,
            subscription: buildSubscriptionPayload(u),
            isPremium: hasPremiumAccess(u)
        }));

        // Sort: Online first, then by last active
        formatted.sort((a, b) => {
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;
            return new Date(b.lastActive) - new Date(a.lastActive);
        });

        res.json({ success: true, users: formatted });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── INSTANT MATCH (For Direct Chatting) ───────────────────
router.post("/instant-match/:targetId", auth, async (req, res) => {
    try {
        const { targetId } = req.params;
        const userId = req.userId;

        let match = await Match.findOne({
            $or: [
                { user1Id: userId, user2Id: targetId },
                { user1Id: targetId, user2Id: userId }
            ]
        });

        if (!match) {
            match = await Match.create({
                user1Id: userId,
                user2Id: targetId,
                status: "matched",
                matchedAt: new Date(),
                mutualMatch: false, // Instant message is NOT a mutual match yet
                isApproved: false // Require approval for first message
            });
        }

        res.json({ success: true, matchId: match._id });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── BLOCK USER ─────────────────────────────────────────────
router.post("/block/:userId", auth, async (req, res) => {
    try {
        const blockerId = req.userId;
        const blockedId = req.params.userId;

        if (blockerId === blockedId) {
            return res.status(400).json({ message: "Cannot block yourself", success: false });
        }

        const user = await User.findById(blockerId);
        if (!user.blockedUsers) user.blockedUsers = [];

        // Check if already blocked
        if (user.blockedUsers.includes(blockedId)) {
            return res.status(400).json({ message: "User already blocked", success: false });
        }

        user.blockedUsers.push(blockedId);
        await user.save();

        // 2. Mark any existing match as blocked instead of deleting it
        await Match.updateMany({
            $or: [
                { user1Id: blockerId, user2Id: blockedId },
                { user1Id: blockedId, user2Id: blockerId }
            ]
        }, { status: "blocked" });

        // 2. Mark all unread messages/notifications as read between them
        await Promise.all([
            Message.updateMany(
                { receiverId: blockedId, senderId: blockerId, "readStatus.read": false },
                { "readStatus.read": true, "readStatus.readAt": new Date() }
            ),
            Message.updateMany(
                { receiverId: blockerId, senderId: blockedId, "readStatus.read": false },
                { "readStatus.read": true, "readStatus.readAt": new Date() }
            ),
            Notification.updateMany(
                { userId: blockedId, read: false, "data.senderId": String(blockerId) },
                { read: true }
            ),
            Notification.updateMany(
                { userId: blockerId, read: false, "data.senderId": String(blockedId) },
                { read: true }
            )
        ]);

        // 3. Emit countsUpdate to both parties so badge refreshes
        const io = req.app.get("io");
        const redisClient = req.app.get("redisClient");
        await Promise.all([
            emitToUserSockets(io, redisClient, blockerId, "countsUpdate", { source: "block" }),
            emitToUserSockets(io, redisClient, blockedId, "countsUpdate", { source: "blocked" })
        ]);

        res.json({ success: true, message: "User blocked successfully" });
    } catch (err) {
        console.error("Block user error:", err);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── UNBLOCK USER ───────────────────────────────────────────
router.post("/unblock/:userId", auth, async (req, res) => {
    try {
        const blockerId = req.userId;
        const blockedId = req.params.userId;

        const user = await User.findById(blockerId);
        if (!user.blockedUsers || user.blockedUsers.length === 0) {
            return res.status(400).json({ message: "No blocked users", success: false });
        }

        user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== blockedId);
        await user.save();

        // Restore any blocked match status
        await Match.updateOne(
            {
                $or: [
                    { user1Id: blockerId, user2Id: blockedId },
                    { user1Id: blockedId, user2Id: blockerId }
                ],
                status: "blocked"
            },
            { status: "active" }
        );

        // Delete the block user action to restore discovery
        await UserAction.deleteOne({
            userId: blockerId,
            targetUserId: blockedId,
            actionType: "block"
        });

        res.json({ success: true, message: "User unblocked successfully" });
    } catch (err) {
        console.error("Unblock user error:", err);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── GET BLOCKED USERS ──────────────────────────────────────
router.get("/blocked", auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).populate("blockedUsers", "name profilePhotos");
        const locked = !hasPremiumAccess(user);

        res.json({
            success: true,
            locked: locked,
            blockedUsers: (user.blockedUsers || []).map(u => ({
                id: u._id,
                name: u.name,
                photo: u.profilePhotos?.[0]?.url
            }))
        });
    } catch (err) {
        console.error("Get blocked users error:", err);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── REPORT USER ────────────────────────────────────────────
const Report = require("../models/Report");
router.post("/report/:userId", auth, async (req, res) => {
    try {
        const reporterId = req.userId;
        const reportedId = req.params.userId;
        const { reason, details } = req.body;

        if (reporterId === reportedId) {
            return res.status(400).json({ message: "Cannot report yourself", success: false });
        }

        // Create report
        await Report.create({
            reporterId,
            reportedId,
            reason: reason || "Other",
            details: details || "",
            status: "pending",
            createdAt: new Date()
        });

        // Auto-block the reported user for reporter's safety
        const user = await User.findById(reporterId);
        if (!user.blockedUsers) user.blockedUsers = [];
        if (!user.blockedUsers.includes(reportedId)) {
            user.blockedUsers.push(reportedId);
            await user.save();
        }

        res.json({ success: true, message: "Report submitted successfully" });
    } catch (err) {
        console.error("Report user error:", err);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── GET USERS I'VE LIKED ─────────────────────────────────────
router.get("/my-likes", auth, async (req, res) => {
    try {
        const userId = req.userId;
        const me = await User.findById(userId);
        const blockedUsers = me?.blockedUsers || [];

        const likesGiven = await UserAction.find({ 
            userId, 
            actionType: "like",
            targetUserId: { $nin: blockedUsers } 
        })
            .populate("targetUserId", "name profilePhotos lastActive state city gender bio dateOfBirth isOnline")
            .sort({ timestamp: -1 })
            .limit(100);

        const locked = !hasPremiumAccess(me);

        const formattedLikes = likesGiven.map(l => ({
            actionId: l._id,
            id: l.targetUserId._id,
            name: l.targetUserId.name,
            photo: l.targetUserId.profilePhotos?.[0]?.url || "https://via.placeholder.com/150",
            age: calculateAge(l.targetUserId.dateOfBirth?.fullDate),
            isOnline: l.targetUserId.isOnline,
            state: l.targetUserId.state,
            city: l.targetUserId.city,
            gender: l.targetUserId.gender,
            timestamp: l.timestamp
        }));

        res.json({ success: true, likes: formattedLikes, locked: locked });
    } catch (err) {
        console.error("Get my likes error:", err);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── UNLIKE USER ─────────────────────────────────────────────
router.delete("/unlike/:userId", auth, async (req, res) => {
    try {
        const userId = req.userId;
        const targetId = req.params.userId;

        // Delete the like action
        const result = await UserAction.deleteOne({
            userId: userId,
            targetUserId: targetId,
            actionType: "like"
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Like not found", success: false });
        }

        // Decrease the target user's like count
        await User.findByIdAndUpdate(targetId, {
            $inc: { "stats.totalLikes": -1 }
        });

        res.json({ success: true, message: "Unliked successfully" });
    } catch (err) {
        console.error("Unlike error:", err);
        res.status(500).json({ message: "Server error", success: false });
    }
});

module.exports = router;