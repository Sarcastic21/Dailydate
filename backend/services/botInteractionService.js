const User = require("../models/User");
const Message = require("../models/Message");
const Match = require("../models/Match");
const ProfileView = require("../models/ProfileView");
const UserAction = require("../models/UserAction");
const { botQueue, redisConnection } = require("../queues/botQueue");
const mongoose = require("mongoose");
const { createNotification } = require("./notificationService");
const { hasPremiumAccess } = require("./subscription");

// ── Simple Helpers ─────────────────────────────────────────────────
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const GREETINGS = [
    "Hyy", "Hellooo", "Hiiiii", "Heyyy", "Hy",
    "Hii", "Hey ", "Hi kaha se ho", "Hello ",
    "Hey ", "Hi ", "Hello jiiii ",
];

// ── Duplicate Prevention Helpers ───────────────────────────────────

/**
 * Check if a bot has already viewed this user
 */
const hasBotViewedUser = async (botId, userId) => {
    const existing = await ProfileView.findOne({ viewerId: botId, targetUserId: userId });
    return !!existing;
};

/**
 * Check if a bot has already liked this user
 */
const hasBotLikedUser = async (botId, userId) => {
    const existing = await UserAction.findOne({
        userId: botId,
        targetUserId: userId,
        actionType: "like"
    });
    return !!existing;
};

/**
 * Check if a bot has already messaged this user
 */
const hasBotMessagedUser = async (botId, userId) => {
    const match = await Match.findOne({
        $or: [
            { user1Id: botId, user2Id: userId },
            { user1Id: userId, user2Id: botId }
        ]
    });
    if (!match) return false;
    const msgCount = await Message.countDocuments({ matchId: match._id, senderId: botId });
    return msgCount > 0;
};

/**
 * Resolve what gender bot should interact with the real user
 */
const resolveBotGender = (user) => {
    if (user.lookingFor === "male") return "male";
    if (user.lookingFor === "female") return "female";
    // Fallback based on user gender
    const g = String(user.gender || "").toLowerCase().trim();
    if (g === "male") return "female";
    if (g === "female") return "male";
    return Math.random() > 0.5 ? "male" : "female";
};

/**
 * Find a random bot of specified gender, preferring same state, excluding already-used bots
 */
const findBot = async (user, botGender, excludeBotIds = []) => {
    const excludeIds = excludeBotIds.map(id => mongoose.Types.ObjectId(id));
    const query = { userType: "bot", gender: botGender, _id: { $nin: excludeIds } };

    let bots = [];
    if (user.state) {
        bots = await User.find({ ...query, state: user.state }).limit(30);
    }
    if (bots.length < 5) {
        const globalBots = await User.find(query).limit(30);
        const existingIds = new Set(bots.map(b => String(b._id)));
        for (const b of globalBots) {
            if (!existingIds.has(String(b._id))) bots.push(b);
        }
    }
    if (bots.length === 0) return null;
    return bots[Math.floor(Math.random() * bots.length)];
};

// ── Core Logic: Schedule Activities ────────────────────────────────

/**
 * ONLINE USERS:
 *  - Views: 3–5 per session, spread randomly every 1–10 min, no repeat bot
 *  - Likes:  1–3 per session, spread randomly every 1–10 min, no repeat bot
 *  - Messages:
 *      Female user → 2–4 messages in 30 min (regardless of online/offline)
 *      Male user   → 1–2 messages in 60 min (regardless of online/offline)
 *
 * OFFLINE USERS (0–3 hours offline):
 *  - Views: 3–4 in 1 hour, then 1–3 in 6 hours (slows down after 3 hrs)
 *  - Likes:  1–2 in 1 hour, then 1 in 6 hours
 *  - Messages: same constant rule as online (by gender)
 *
 * All bots used for views and likes are unique per user per session.
 */
const scheduleInitialActivity = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user || user.userType !== "real") return;

        const botGender = resolveBotGender(user);
        const isOnline = user.isOnline || false;
        const isFemale = String(user.gender || "").toLowerCase() === "female";
        const activities = [];
        const usedBotIds = []; // Track bots used for views/likes to prevent repeats

        // ── VIEWS ──────────────────────────────────────────────────
        const viewCount = isOnline ? randInt(3, 5) : randInt(3, 4);
        const viewWindowMin = isOnline ? 10 : 60; // spread within this window

        for (let i = 0; i < viewCount; i++) {
            const bot = await findBot(user, botGender, usedBotIds);
            if (!bot) break;
            usedBotIds.push(String(bot._id));

            // Spread views evenly with randomness across the window
            const delayMin = Math.round((viewWindowMin / viewCount) * i) + randInt(1, 3);

            activities.push({
                botId: bot._id,
                activityType: "view",
                delayMin
            });
        }

        // ── LIKES ──────────────────────────────────────────────────
        const likeCount = isOnline ? randInt(1, 3) : randInt(1, 2);
        const likeWindowMin = isOnline ? 10 : 60;

        for (let i = 0; i < likeCount; i++) {
            const bot = await findBot(user, botGender, usedBotIds);
            if (!bot) break;
            usedBotIds.push(String(bot._id));

            const delayMin = Math.round((likeWindowMin / likeCount) * i) + randInt(2, 5);

            activities.push({
                botId: bot._id,
                activityType: "like",
                delayMin
            });
        }

        // Female user: 2–4 messages in 30 min window (starting after 15 min)
        // Male user:   1–2 messages in 60 min window (starting after 30 min)
        const msgCount = isFemale ? randInt(2, 4) : randInt(1, 2);
        const msgWindowMin = isFemale ? 30 : 60;
        const msgStartDelay = isFemale ? 15 : 30; // ── NEW: Grace period ──

        for (let i = 0; i < msgCount; i++) {
            const bot = await findBot(user, botGender, []); // Bots for messages can overlap
            if (!bot) break;

            const delayMin = msgStartDelay + Math.round((msgWindowMin / msgCount) * i) + randInt(5, 10);

            activities.push({
                botId: bot._id,
                activityType: "message",
                content: pick(GREETINGS),
                delayMin
            });
        }

        // ── QUEUE ALL ──────────────────────────────────────────────
        for (const activity of activities) {
            const delayMs = activity.delayMin * 60 * 1000;
            await botQueue.add(activity.activityType, {
                userId,
                botId: activity.botId,
                activityType: activity.activityType,
                content: activity.content || undefined
            }, { delay: delayMs });
        }

        console.log(`✅ Scheduled ${activities.length} activities for user ${userId} (online=${isOnline})`);
    } catch (error) {
        console.error("Error scheduling bot activity:", error);
    }
};

// ── Continuous Engagement Loops ────────────────────────────────────

/**
 * Called on a cron (every ~5 min).
 * For ONLINE users: keeps sending views (1–10 min gap) and likes (1–10 min gap).
 * Uses Redis to ensure each cycle doesn't overlap with previous.
 */
const processOnlineEngagement = async () => {
    try {
        const onlineUsers = await User.find({
            userType: "real",
            isProfileComplete: true,
            isOnline: true,
            lastActive: { $gte: new Date(Date.now() - 3 * 60 * 60 * 1000) }
        });

        for (const user of onlineUsers) {
            const botGender = resolveBotGender(user);

            // ── View ────────────────────────────────────────────────
            const viewKey = `bot:online_view:${user._id}`;
            if (!(await redisConnection.get(viewKey))) {
                // Find a bot this user hasn't been viewed by recently
                const bot = await findBot(user, botGender, []);
                if (bot) {
                    const alreadyViewed = await hasBotViewedUser(bot._id, user._id);
                    if (!alreadyViewed) {
                        const delayMin = randInt(1, 10);
                        await botQueue.add('view', { userId: user._id, botId: bot._id, activityType: 'view' }, { delay: delayMin * 60000 });
                        // Block next view for 1–10 min (same window)
                        await redisConnection.setex(viewKey, randInt(1, 10) * 60, "true");
                        console.log(`[OnlineEngagement] View → user ${user._id} from bot ${bot._id} in ${delayMin}m`);
                    }
                }
            }

            // ── Like ────────────────────────────────────────────────
            const likeKey = `bot:online_like:${user._id}`;
            if (!(await redisConnection.get(likeKey))) {
                const bot = await findBot(user, botGender, []);
                if (bot) {
                    const alreadyLiked = await hasBotLikedUser(bot._id, user._id);
                    if (!alreadyLiked) {
                        const delayMin = randInt(1, 10);
                        await botQueue.add('like', { userId: user._id, botId: bot._id, activityType: 'like' }, { delay: delayMin * 60000 });
                        await redisConnection.setex(likeKey, randInt(1, 10) * 60, "true");
                        console.log(`[OnlineEngagement] Like → user ${user._id} from bot ${bot._id} in ${delayMin}m`);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error in processOnlineEngagement:", error);
    }
};

/**
 * Called on a cron (every ~15 min).
 * For OFFLINE users:
 *   - 0–3 hours offline: 3–4 views/hour, 1–2 likes/hour
 *   - 3+ hours offline:  1–3 views/6hr,  1–2 likes/6hr (slow drip)
 */
const processOfflineEngagement = async () => {
    try {
        const offlineUsers = await User.find({
            userType: "real",
            isProfileComplete: true,
            isOnline: false
        });

        for (const user of offlineUsers) {
            const lastActiveMs = user.lastActive ? user.lastActive.getTime() : 0;
            const hoursOffline = (Date.now() - lastActiveMs) / (1000 * 60 * 60);

            // Stop engaging after 24 hours offline
            if (hoursOffline > 24) continue;

            const isEarlyOffline = hoursOffline <= 3; // First 3 hours
            const botGender = resolveBotGender(user);

            // ── View ────────────────────────────────────────────────
            // Early offline: 3–4 views per hour → gap = 60/3.5 ≈ 15–20 min
            // Late offline:  1–3 views per 6hr  → gap = 360/2   ≈ 120–360 min
            const viewKey = `bot:offline_view:${user._id}`;
            if (!(await redisConnection.get(viewKey))) {
                const bot = await findBot(user, botGender, []);
                if (bot) {
                    const alreadyViewed = await hasBotViewedUser(bot._id, user._id);
                    if (!alreadyViewed) {
                        const delayMin = isEarlyOffline ? randInt(5, 15) : randInt(30, 60);
                        await botQueue.add('view', { userId: user._id, botId: bot._id, activityType: 'view' }, { delay: delayMin * 60000 });

                        // Block window: early=15–20min, late=2–3hr
                        const blockMin = isEarlyOffline ? randInt(15, 20) : randInt(120, 180);
                        await redisConnection.setex(viewKey, blockMin * 60, "true");
                        console.log(`[OfflineEngagement] View → user ${user._id} (${hoursOffline.toFixed(1)}h offline) from bot ${bot._id} in ${delayMin}m`);
                    }
                }
            }

            // ── Like ────────────────────────────────────────────────
            // Early offline: 1–2 per hour → gap ≈ 30–60 min
            // Late offline:  1–2 per 6hr  → gap ≈ 3–6 hr
            const likeKey = `bot:offline_like:${user._id}`;
            if (!(await redisConnection.get(likeKey))) {
                const bot = await findBot(user, botGender, []);
                if (bot) {
                    const alreadyLiked = await hasBotLikedUser(bot._id, user._id);
                    if (!alreadyLiked) {
                        const delayMin = isEarlyOffline ? randInt(10, 30) : randInt(60, 120);
                        await botQueue.add('like', { userId: user._id, botId: bot._id, activityType: 'like' }, { delay: delayMin * 60000 });

                        const blockMin = isEarlyOffline ? randInt(30, 60) : randInt(180, 360);
                        await redisConnection.setex(likeKey, blockMin * 60, "true");
                        console.log(`[OfflineEngagement] Like → user ${user._id} (${hoursOffline.toFixed(1)}h offline) from bot ${bot._id} in ${delayMin}m`);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error in processOfflineEngagement:", error);
    }
};

/**
 * Called on a cron (every ~10 min).
 * Sends messages at a CONSTANT rate regardless of online/offline status:
 *   Female user: 2–4 messages per 30 min window
 *   Male user:   1–2 messages per 60 min window
 */
const processMessageEngagement = async () => {
    try {
        const users = await User.find({
            userType: "real",
            isProfileComplete: true,
            lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Active in last 24h
            createdAt: { $lte: new Date(Date.now() - 60 * 60 * 1000) } // ── NEW: Account must be at least 1 hour old ──
        });

        for (const user of users) {
            const isFemale = String(user.gender || "").toLowerCase() === "female";
            const msgKey = `bot:message:${user._id}`;

            if (await redisConnection.get(msgKey)) continue; // Still in cooldown

            // ── NEW: Ensure user has at least one view or like before messaging ──
            if ((user.stats?.profileViews || 0) === 0 && (user.stats?.totalLikes || 0) === 0) {
                continue; 
            }

            const botGender = resolveBotGender(user);
            const bot = await findBot(user, botGender, []);
            if (!bot) continue;

            const alreadyMessaged = await hasBotMessagedUser(bot._id, user._id);
            if (alreadyMessaged) continue; // Each bot only messages once

            const delayMin = isFemale ? randInt(2, 8) : randInt(5, 15);
            await botQueue.add('message', {
                userId: user._id,
                botId: bot._id,
                activityType: 'message',
                content: pick(GREETINGS)
            }, { delay: delayMin * 60000 });

            // Cooldown until next message slot:
            // Female: 30min / (2–4 msgs) ≈ 7–15 min gap
            // Male:   60min / (1–2 msgs) ≈ 30–60 min gap
            const blockMin = isFemale ? randInt(7, 15) : randInt(30, 60);
            await redisConnection.setex(msgKey, blockMin * 60, "true");

            console.log(`[MessageEngagement] Message → user ${user._id} (${user.gender}) from bot ${bot._id} in ${delayMin}m, next in ${blockMin}m`);
        }
    } catch (error) {
        console.error("Error in processMessageEngagement:", error);
    }
};

// ── Bot Online Status ──────────────────────────────────────────────

const updateBotOnlineStatus = async () => {
    try {
        const botUsers = await User.find({ userType: "bot" });
        if (botUsers.length === 0) return;

        const hourOfDay = new Date().getHours();
        const isPeakHour = hourOfDay >= 12 && hourOfDay <= 19;
        const onlineProbability = isPeakHour ? 0.75 : 0.55;

        const updatePromises = botUsers.map(async (bot) => {
            const isOnline = bot.isOnline
                ? Math.random() < 0.8         // Sticky: online bots tend to stay online
                : Math.random() < onlineProbability;

            return User.findByIdAndUpdate(bot._id, {
                isOnline,
                lastActive: isOnline
                    ? new Date(Date.now() - Math.floor(Math.random() * 10 * 60 * 1000))
                    : bot.lastActive
            });
        });

        await Promise.all(updatePromises);
        console.log(`✅ Updated online status for ${botUsers.length} bots (peak=${isPeakHour})`);
    } catch (error) {
        console.error("❌ Error updating bot online status:", error);
    }
};

// ── Execute Actions ────────────────────────────────────────────────

const getFullBot = async (bot) => {
    if (bot.profilePhotos && bot.name) return bot;
    return await User.findById(bot._id).select("name profilePhotos");
};

const executeView = async (user, bot) => {
    const fullBot = await getFullBot(bot);
    if (!fullBot) return;

    const isPremium = hasPremiumAccess(user);
    const viewerName = isPremium ? fullBot.name : "Someone";
    const viewerPhoto = fullBot.profilePhotos?.[0]?.url;

    const existingView = await ProfileView.findOne({ viewerId: fullBot._id, targetUserId: user._id });

    if (!existingView) {
        await ProfileView.create({ viewerId: fullBot._id, targetUserId: user._id });
        await User.findByIdAndUpdate(user._id, { $inc: { "stats.profileViews": 1 } });

        await createNotification(user._id, "view",
            isPremium ? `${viewerName} viewed you! 👀` : "Someone viewed your profile 👀",
            isPremium ? "They checked out your profile!" : "Upgrade to see who it is!",
            {
                type: "view",
                viewerId: String(fullBot._id),
                viewerName,
                viewerPhoto,
                isLocked: String(!isPremium)
            });
    } else {
        const hoursSinceLastView = (Date.now() - existingView.viewedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastView >= 1) {
            existingView.viewedAt = new Date();
            await existingView.save();

            await createNotification(user._id, "revisit",
                isPremium ? `${viewerName} viewed you again 👀` : "Someone viewed you again 👀",
                "They came back to see your profile!",
                {
                    type: "revisit",
                    viewerId: String(fullBot._id),
                    viewerName,
                    viewerPhoto,
                    isLocked: String(!isPremium),
                    revisitCount: "2+"
                });
        }
    }
};

const executeLike = async (user, bot) => {
    const fullBot = await getFullBot(bot);
    if (!fullBot) return;

    const isPremium = hasPremiumAccess(user);
    const senderName = isPremium ? fullBot.name : "Someone";
    const senderPhoto = fullBot.profilePhotos?.[0]?.url;

    const existingLike = await UserAction.findOne({
        userId: fullBot._id,
        targetUserId: user._id,
        actionType: "like"
    });

    if (!existingLike) {
        await UserAction.create({
            userId: fullBot._id,
            targetUserId: user._id,
            actionType: "like",
            timestamp: new Date()
        });
        await User.findByIdAndUpdate(user._id, { $inc: { "stats.totalLikes": 1 } });

        await createNotification(user._id, "like",
            isPremium ? `${senderName} liked you! ❤️` : "Someone liked you! ❤️",
            isPremium ? "Check out their profile now!" : "Upgrade to see who it is!",
            {
                type: "like",
                senderId: String(fullBot._id),
                senderName,
                senderPhoto,
                isLocked: String(!isPremium)
            });
    }
};

const executeMessage = async (user, bot, content) => {
    const fullBot = await getFullBot(bot);
    if (!fullBot) return;

    const isPremium = hasPremiumAccess(user);
    const senderName = isPremium ? fullBot.name : "Someone";
    const senderPhoto = fullBot.profilePhotos?.[0]?.url;
    const finalContent = content || pick(GREETINGS);

    // Final safety check: Don't message if user has 0 views and 0 likes
    // (This handles cases where jobs might have been scheduled early)
    const currentUser = await User.findById(user._id).select("stats");
    if (currentUser && (currentUser.stats?.profileViews || 0) === 0 && (currentUser.stats?.totalLikes || 0) === 0) {
        console.log(`[BotInteraction] Skipping executeMessage for ${user._id} - No views/likes yet.`);
        return;
    }

    console.log(`[BotInteraction] executeMessage: content="${finalContent}"`);

    const hasMessagedBefore = await hasBotMessagedUser(fullBot._id, user._id);

    let match = await Match.findOne({
        $or: [
            { user1Id: user._id, user2Id: fullBot._id },
            { user1Id: fullBot._id, user2Id: user._id }
        ]
    });

    if (!match) {
        match = await Match.create({
            user1Id: fullBot._id,
            user2Id: user._id,
            status: "matched",
            mutualMatch: false,
            isApproved: false
        });
    }

    if (!hasMessagedBefore) {
        await Message.create({
            matchId: match._id,
            senderId: fullBot._id,
            receiverId: user._id,
            content: finalContent
        });

        await createNotification(user._id, "message",
            isPremium ? `New message from ${senderName}` : "New message received",
            isPremium ? finalContent : "Someone messaged you. Upgrade to chat back!",
            {
                type: "message",
                matchId: String(match._id),
                senderId: String(fullBot._id),
                senderName,
                senderPhoto,
                isLocked: String(!isPremium)
            });
    }
};

const cancelAllPending = async (userId) => {
    await redisConnection.setex(`bot:cancelled:${userId}`, 3600 * 6, "true");
};

// ── Reactive Engagement ────────────────────────────────────────────

/**
 * When a real user likes a bot — bot reacts naturally
 */
const handleReactiveEngagement = async (userId, botId) => {
    try {
        const user = await User.findById(userId).select("gender");
        const bot = await User.findById(botId).select("gender");
        if (!user || !bot) return;

        const isMaleUser = String(user.gender).toLowerCase() === "male";
        const isFemaleBot = String(bot.gender).toLowerCase() === "female";
        const isFemaleUser = String(user.gender).toLowerCase() === "female";
        const isMaleBot = String(bot.gender).toLowerCase() === "male";

        const roll = Math.random();

        if (isMaleUser && isFemaleBot) {
            // Girls rarely respond back
            if (roll < 0.4) return;
            if (roll < 0.7) {
                await botQueue.add('view', { userId, botId, activityType: 'view' }, { delay: randInt(1, 5) * 60000 });
            } else {
                await botQueue.add('view', { userId, botId, activityType: 'view' }, { delay: randInt(1, 3) * 60000 });
                await botQueue.add('like', { userId, botId, activityType: 'like' }, { delay: randInt(4, 10) * 60000 });
            }
        } else if (isFemaleUser && isMaleBot) {
            // Boys respond fast and message first
            if (roll < 0.1) return;
            if (roll < 0.3) {
                await botQueue.add('view', { userId, botId, activityType: 'view' }, { delay: randInt(1, 2) * 60000 });
                await botQueue.add('like', { userId, botId, activityType: 'like' }, { delay: randInt(3, 5) * 60000 });
            } else {
                await botQueue.add('view', { userId, botId, activityType: 'view' }, { delay: randInt(1, 2) * 60000 });
                await botQueue.add('like', { userId, botId, activityType: 'like' }, { delay: randInt(3, 5) * 60000 });
                await botQueue.add('message', {
                    userId, botId, activityType: 'message', content: pick(GREETINGS)
                }, { delay: randInt(6, 12) * 60000 });
            }
        }
    } catch (err) {
        console.error("Error in handleReactiveEngagement:", err);
    }
};

/**
 * One-time bot auto-reply when user sends a message first
 */
const handleBotReply = async (userId, botId, matchId) => {
    try {
        const redisKey = `bot:replied:${matchId}`;
        const hasReplied = await redisConnection.get(redisKey);
        if (hasReplied) return;

        const bot = await User.findById(botId).select("isOnline");
        if (!bot || !bot.isOnline) return;

        const reply = Math.random() < 0.5 ? "Hy" : "Hello";
        await botQueue.add('message', {
            userId, botId, activityType: 'message', content: reply
        }, { delay: randInt(2, 3) * 60000 });

        await redisConnection.setex(redisKey, 86400, "true");
    } catch (err) {
        console.error("Error in handleBotReply:", err);
    }
};

module.exports = {
    scheduleInitialActivity,
    processOnlineEngagement,
    processOfflineEngagement,
    processMessageEngagement,   // ← NEW: add this to your cron
    updateBotOnlineStatus,
    cancelAllPending,
    executeView,
    executeLike,
    executeMessage,
    handleBotReply,
    handleReactiveEngagement
};