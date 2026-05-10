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

        // Female user: 1–2 messages in 24 hour window
        // Male user:   1–2 messages in 24 hour window
        const msgCount = randInt(1, 2);
        const msgWindowMin = 1440; // 24 hours
        const msgStartDelay = randInt(30, 60); // Start after 30-60 min

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

        console.log(`[OnlineEngagement] Processing ${onlineUsers.length} online users`);

        // Batch Redis keys to reduce calls
        const viewKeys = onlineUsers.map(u => `bot:online_view:${u._id}`);
        const likeKeys = onlineUsers.map(u => `bot:online_like:${u._id}`);
        
        const viewKeyResults = await Promise.all(viewKeys.map(key => redisConnection.get(key)));
        const likeKeyResults = await Promise.all(likeKeys.map(key => redisConnection.get(key)));

        for (let i = 0; i < onlineUsers.length; i++) {
            const user = onlineUsers[i];
            const botGender = resolveBotGender(user);

            // ── View ────────────────────────────────────────────────
            if (!viewKeyResults[i]) {
                const bot = await findBot(user, botGender, []);
                if (bot) {
                    const alreadyViewed = await hasBotViewedUser(bot._id, user._id);
                    if (!alreadyViewed) {
                        const delayMin = randInt(1, 10);
                        await botQueue.add('view', { userId: user._id, botId: bot._id, activityType: 'view' }, { delay: delayMin * 60000 });
                        await redisConnection.setex(viewKeys[i], randInt(1, 10) * 60, "true");
                        console.log(`[OnlineEngagement] View → user ${user._id} from bot ${bot._id} in ${delayMin}m`);
                    }
                }
            }

            // ── Like ────────────────────────────────────────────────
            if (!likeKeyResults[i]) {
                const bot = await findBot(user, botGender, []);
                if (bot) {
                    const alreadyLiked = await hasBotLikedUser(bot._id, user._id);
                    if (!alreadyLiked) {
                        const delayMin = randInt(1, 10);
                        await botQueue.add('like', { userId: user._id, botId: bot._id, activityType: 'like' }, { delay: delayMin * 60000 });
                        await redisConnection.setex(likeKeys[i], randInt(1, 10) * 60, "true");
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

        console.log(`[OfflineEngagement] Processing ${offlineUsers.length} offline users`);

        // Filter users by offline time first
        const eligibleUsers = [];
        for (const user of offlineUsers) {
            const lastActiveMs = user.lastActive ? user.lastActive.getTime() : 0;
            const hoursOffline = (Date.now() - lastActiveMs) / (1000 * 60 * 60);
            if (hoursOffline <= 24) {
                eligibleUsers.push({ user, hoursOffline });
            }
        }

        // Batch Redis keys
        const viewKeys = eligibleUsers.map(({ user }) => `bot:offline_view:${user._id}`);
        const likeKeys = eligibleUsers.map(({ user }) => `bot:offline_like:${user._id}`);
        
        const viewKeyResults = await Promise.all(viewKeys.map(key => redisConnection.get(key)));
        const likeKeyResults = await Promise.all(likeKeys.map(key => redisConnection.get(key)));

        for (let i = 0; i < eligibleUsers.length; i++) {
            const { user, hoursOffline } = eligibleUsers[i];
            const isEarlyOffline = hoursOffline <= 3;
            const botGender = resolveBotGender(user);

            // ── View ────────────────────────────────────────────────
            if (!viewKeyResults[i]) {
                const bot = await findBot(user, botGender, []);
                if (bot) {
                    const alreadyViewed = await hasBotViewedUser(bot._id, user._id);
                    if (!alreadyViewed) {
                        const delayMin = isEarlyOffline ? randInt(5, 15) : randInt(30, 60);
                        await botQueue.add('view', { userId: user._id, botId: bot._id, activityType: 'view' }, { delay: delayMin * 60000 });
                        const blockMin = isEarlyOffline ? randInt(15, 20) : randInt(120, 180);
                        await redisConnection.setex(viewKeys[i], blockMin * 60, "true");
                        console.log(`[OfflineEngagement] View → user ${user._id} (${hoursOffline.toFixed(1)}h offline) from bot ${bot._id} in ${delayMin}m`);
                    }
                }
            }

            // ── Like ────────────────────────────────────────────────
            if (!likeKeyResults[i]) {
                const bot = await findBot(user, botGender, []);
                if (bot) {
                    const alreadyLiked = await hasBotLikedUser(bot._id, user._id);
                    if (!alreadyLiked) {
                        const delayMin = isEarlyOffline ? randInt(10, 30) : randInt(60, 120);
                        await botQueue.add('like', { userId: user._id, botId: bot._id, activityType: 'like' }, { delay: delayMin * 60000 });
                        const blockMin = isEarlyOffline ? randInt(30, 60) : randInt(180, 360);
                        await redisConnection.setex(likeKeys[i], blockMin * 60, "true");
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
            lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            createdAt: { $lte: new Date(Date.now() - 60 * 60 * 1000) }
        });

        console.log(`[MessageEngagement] Processing ${users.length} users`);

        // Batch Redis keys
        const msgKeys = users.map(u => `bot:message:${u._id}`);
        const msgKeyResults = await Promise.all(msgKeys.map(key => redisConnection.get(key)));

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            
            if (msgKeyResults[i]) continue; // Still in 24-hour cooldown

            // ── Ensure user has at least one view or like before messaging
            if ((user.stats?.profileViews || 0) === 0 && (user.stats?.totalLikes || 0) === 0) {
                continue;
            }

            const botGender = resolveBotGender(user);
            const bot = await findBot(user, botGender, []);
            if (!bot) continue;

            const alreadyMessaged = await hasBotMessagedUser(bot._id, user._id);
            if (alreadyMessaged) continue;

            const delayMin = randInt(5, 30);
            await botQueue.add('message', {
                userId: user._id,
                botId: bot._id,
                activityType: 'message',
                content: pick(GREETINGS)
            }, { delay: delayMin * 60000 });

            // 24-hour cooldown (86400 seconds)
            await redisConnection.setex(msgKeys[i], 86400, "true");

            console.log(`[MessageEngagement] Message → user ${user._id} from bot ${bot._id} in ${delayMin}m, 24h cooldown`);
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

        console.log(`[BotOnlineStatus] Processing ${botUsers.length} bots`);

        const hourOfDay = new Date().getHours();
        const isPeakHour = hourOfDay >= 12 && hourOfDay <= 19;
        const onlineProbability = isPeakHour ? 0.75 : 0.55;

        // Process in batches to reduce memory pressure
        const batchSize = 50;
        for (let i = 0; i < botUsers.length; i += batchSize) {
            const batch = botUsers.slice(i, i + batchSize);
            const updatePromises = batch.map(async (bot) => {
                const isOnline = bot.isOnline
                    ? Math.random() < 0.8
                    : Math.random() < onlineProbability;

                return User.findByIdAndUpdate(bot._id, {
                    isOnline,
                    lastActive: isOnline
                        ? new Date(Date.now() - Math.floor(Math.random() * 10 * 60 * 1000))
                        : bot.lastActive
                });
            });

            await Promise.all(updatePromises);
        }

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