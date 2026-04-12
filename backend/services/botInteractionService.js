const User = require("../models/User");
const Message = require("../models/Message");
const Match = require("../models/Match");
const ProfileView = require("../models/ProfileView");
const UserAction = require("../models/UserAction");
const { botQueue, redisConnection } = require("../queues/botQueue");
const mongoose = require("mongoose");
const { createNotification } = require("./notificationService");
const { hasPremiumAccess } = require("./subscription");

// ── Advanced Human-Like Bot Timing ─────────────────────────────────
// Uses variable intervals with clustering to simulate real human behavior

// Random generators
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randFloat = (min, max) => Math.random() * (max - min) + min;

// Human-like clustering: bots are active in bursts, then quiet
// Returns array of delays in minutes for a given time window
const generateHumanTiming = (totalWindowMin, activityCount, burstiness = 0.7) => {
    const delays = [];
    let currentTime = 0;

    for (let i = 0; i < activityCount; i++) {
        // Variable gaps: sometimes short (1-2 min), sometimes medium (4-8 min), sometimes long (10-20 min)
        const gapType = Math.random();
        let gapMin, gapMax;

        if (gapType < 0.4) {
            // Short gap (40% of time) - eager response
            gapMin = 1; gapMax = 3;
        } else if (gapType < 0.75) {
            // Medium gap (35% of time) - normal human delay
            gapMin = 4; gapMax = 8;
        } else if (gapType < 0.9) {
            // Long gap (15% of time) - distracted/busy
            gapMin = 10; gapMax = 20;
        } else {
            // Very long gap (10% of time) - stepped away
            gapMin = 25; gapMax = 45;
        }

        // Add burst clustering - multiple quick actions, then pauses
        if (i > 0 && Math.random() < burstiness && delays[i - 1] < 5) {
            // In a burst - very short gap
            gapMin = 1; gapMax = 2;
        }

        currentTime += randInt(gapMin, gapMax);
        if (currentTime > totalWindowMin) break;
        delays.push(currentTime);
    }
    return delays;
};

// Online timing: very active but human-like
const getOnlineViewTiming = () => generateHumanTiming(15, randInt(3, 6), 0.6); // 3-6 views in 15 min
const getOnlineLikeTiming = () => generateHumanTiming(15, randInt(2, 4), 0.5); // 2-4 likes in 15 min
const getOnlineMsgTiming = () => generateHumanTiming(30, randInt(2, 4), 0.4);  // 2-4 msgs in 30 min

// Sustained online: spread across 24h with variable gaps
const getSustainedOnlineViewTiming = () => {
    const delays = [];
    let cursor = 20; // Start after burst
    while (cursor < 1440) { // 24 hours
        // Variable gaps: 3-15 minutes (humans get distracted)
        const gap = randInt(3, 15);
        cursor += gap;
        if (cursor > 1440) break;
        delays.push(cursor);
        // Occasional long break (10% chance of 30-60 min pause)
        if (Math.random() < 0.1) {
            cursor += randInt(30, 60);
        }
    }
    return delays.slice(0, randInt(30, 50)); // Cap at 30-50 views
};

const getSustainedOnlineMsgTiming = () => {
    const delays = [];
    let cursor = 25;
    while (cursor < 1440) {
        // Messages: 5-20 min gaps (more thoughtful)
        const gap = randInt(5, 20);
        cursor += gap;
        if (cursor > 1440) break;
        delays.push(cursor);
        // Sometimes take a break from messaging
        if (Math.random() < 0.15) {
            cursor += randInt(40, 90);
        }
    }
    return delays.slice(0, randInt(8, 15)); // Cap at 8-15 messages
};

// Offline timing: slow drip, very variable
const getOfflineViewTiming = () => {
    const delays = [];
    let cursor = randInt(30, 120); // First view 30min-2hr
    while (cursor < 1440) {
        // Variable: 1-4 hours between views when offline
        const gapType = Math.random();
        let gap;
        if (gapType < 0.5) gap = randInt(60, 120);      // 1-2 hr (50%)
        else if (gapType < 0.8) gap = randInt(120, 240); // 2-4 hr (30%)
        else gap = randInt(30, 60);                      // Quick check (20%)
        cursor += gap;
        if (cursor > 1440) break;
        delays.push(cursor);
    }
    return delays.slice(0, randInt(4, 8));
};

const getOfflineMsgTiming = () => {
    const delays = [];
    let cursor = randInt(60, 180); // First msg 1-3 hr
    while (cursor < 1440) {
        // 2-6 hours between messages when offline
        const gap = randInt(120, 360);
        cursor += gap;
        if (cursor > 1440) break;
        delays.push(cursor);
    }
    return delays.slice(0, randInt(1, 3));
};

// Richer greeting pool for natural feel
const GREETINGS = [
    "Hyy", "Hellooo", "Hiiiii", "Heyyy", "Hy",
    "Hii", "Hey ", "Hi kaha se ho", "Hello ",
    "Hey ", "Hi ", "Hello jiiii ",
];

// Revisit messages pool
const REVISIT_MESSAGES = [
    "Checked your profile again 😊",
    "Came back to see you",
    "Looking at your profile again",
    "Still interested 😉",
];

// Track bot-user interactions to prevent duplicates
const hasBotMessagedUser = async (botId, userId) => {
    const match = await Match.findOne({
        $or: [
            { user1Id: botId, user2Id: userId },
            { user1Id: userId, user2Id: botId }
        ]
    });
    if (!match) return false;
    const msgCount = await Message.countDocuments({
        matchId: match._id,
        senderId: botId
    });
    return msgCount > 0;
};

/**
 * Resolve the target bot gender for a given real user (cross-gender logic)
 */
const resolveBotGender = (user) => {
    const g = String(user.gender || "").toLowerCase().trim();
    if (g === "male") return "female";
    if (g === "female") return "male";
    if (user.lookingFor === "male") return "male";
    if (user.lookingFor === "female") return "female";
    return Math.random() > 0.5 ? "male" : "female";
};

/**
 * Find candidate bots for a user, preferring same-state then global
 */
const findCandidateBots = async (user, botGender, limit = 20) => {
    const botQuery = { userType: "bot", gender: botGender };
    let bots = [];

    // Prefer same-state bots
    if (user.state) {
        bots = await User.find({ ...botQuery, state: user.state }).limit(limit);
    }

    // Fill from global pool if not enough
    if (bots.length < 10) {
        const globalBots = await User.find(botQuery).limit(limit);
        const existingIds = new Set(bots.map(b => String(b._id)));
        for (const b of globalBots) {
            if (!existingIds.has(String(b._id))) bots.push(b);
        }
    }

    // Shuffle for randomness
    bots.sort(() => Math.random() - 0.5);
    return bots;
};

/**
 * Schedule bot activity for a new user with NATURAL timing
 * Online: fast burst (views 2-4min, likes 3-5min, messages 5-10min) - 8-12 activities max
 * Offline: slow drip (views/likes 1-4hr, messages 2-6hr) - 3-5 activities max
 */
const scheduleInitialActivity = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user || user.userType !== "real" || user.accountType !== "normal") return;

        const botGender = resolveBotGender(user);
        const bots = await findCandidateBots(user, botGender, 10);

        if (bots.length === 0) {
            console.log(`⚠️ No bots found for user ${userId} with gender ${botGender}`);
            return;
        }
        console.log(`✅ Found ${bots.length} candidate bots for user ${userId}`);

        const isOnline = user.isOnline || false;
        const activities = [];
        const now = Date.now();

        if (isOnline) {
            // ONLINE: Quick burst - 8-12 activities in first 30 minutes
            // Views: 4-6 views in first 15 min (2-4 min gaps)
            let viewDelay = randInt(2, 4);
            const viewCount = randInt(4, 6);
            for (let i = 0; i < viewCount; i++) {
                activities.push({
                    userId,
                    botId: pick(bots)._id,
                    activityType: "view",
                    delayMin: viewDelay
                });
                viewDelay += randInt(2, 4); // Next view in 2-4 min
            }

            // Likes: 2-3 likes in first 20 min (3-8 min gaps)
            let likeDelay = randInt(3, 6);
            const likeCount = randInt(2, 3);
            for (let i = 0; i < likeCount; i++) {
                activities.push({
                    userId,
                    botId: pick(bots)._id,
                    activityType: "like",
                    delayMin: likeDelay
                });
                likeDelay += randInt(4, 8); // Next like in 4-8 min
            }

            // Messages: 2-3 messages in first 30 min (8-15 min gaps)
            let msgDelay = randInt(5, 10);
            const msgCount = randInt(2, 3);
            for (let i = 0; i < msgCount; i++) {
                activities.push({
                    userId,
                    botId: pick(bots)._id,
                    activityType: "message",
                    content: pick(GREETINGS),
                    delayMin: msgDelay
                });
                msgDelay += randInt(8, 15); // Next message in 8-15 min
            }
        } else {
            // OFFLINE: Sparse drip - 3-5 activities across 6-12 hours
            // Views: 2-3 views (1-4 hour gaps)
            let viewDelay = randInt(30, 90); // First view 30-90 min
            const viewCount = randInt(2, 3);
            for (let i = 0; i < viewCount; i++) {
                activities.push({
                    userId,
                    botId: pick(bots)._id,
                    activityType: "view",
                    delayMin: viewDelay
                });
                // Next view in 1-4 hours
                const nextGap = Math.random() < 0.5 ? randInt(60, 120) : randInt(120, 240);
                viewDelay += nextGap;
            }

            // Likes: 0-1 likes (1-3 hours)
            if (Math.random() > 0.4) {
                activities.push({
                    userId,
                    botId: pick(bots)._id,
                    activityType: "like",
                    delayMin: randInt(60, 180)
                });
            }

            // Messages: 0-1 messages (2-5 hours)
            if (Math.random() > 0.5) {
                activities.push({
                    userId,
                    botId: pick(bots)._id,
                    activityType: "message",
                    content: pick(GREETINGS),
                    delayMin: randInt(120, 300)
                });
            }
        }

        if (activities.length > 0) {
            for (const activity of activities) {
                const delayMs = activity.delayMin * 60 * 1000;
                await botQueue.add(activity.activityType, {
                    userId: activity.userId,
                    botId: activity.botId,
                    activityType: activity.activityType,
                    content: activity.content
                }, { delay: delayMs > 0 ? delayMs : 0 });
            }
            console.log(`✅ Scheduled ${activities.length} activities for user ${userId} (online=${isOnline})`);
        }
    } catch (error) {
        console.error("Error scheduling bot activity:", error);
    }
};

const processOnlineEngagement = async () => {
    try {
        const onlineUsers = await User.find({
            userType: "real",
            isProfileComplete: true,
            isOnline: true,
            lastActive: { $gte: new Date(Date.now() - 3 * 60 * 60 * 1000) } // Stop if away for > 3 hours
        });

        for (const user of onlineUsers) {
            // Check recent activity using Redis cache instead of DB
            const redisKey = `bot:engagement:${user._id}`;
            const recentActivity = await redisConnection.get(redisKey);
            if (recentActivity) continue; // Skip if they had engagement recently

            const botGender = resolveBotGender(user);

            // Prefer same-state bot, fallback to any
            let bot;
            if (user.state) {
                bot = await User.findOne({ userType: "bot", gender: botGender, state: user.state });
            }
            if (!bot) {
                bot = await User.findOne({ userType: "bot", gender: botGender });
            }
            if (!bot) continue;

            const isPremium = hasPremiumAccess(user);
            // Drastically lower interaction probability for premium users in the general loop
            if (isPremium && Math.random() < 0.7) continue;


            // Check if bot has already liked this user (prevent duplicate likes)
            const hasLiked = await UserAction.findOne({
                userId: bot._id,
                targetUserId: user._id,
                actionType: "like"
            });

            // Check if bot has already messaged
            const hasMessaged = await hasBotMessagedUser(bot._id, user._id);

            // Weighted random based on what's already been done
            // Views always possible, likes only if not done, messages only if not done
            let roll = Math.random();
            let selectedType;

            const isMaleToFemale = String(botGender).toLowerCase() === "male" && String(user.gender).toLowerCase() === "female";

            if (hasLiked && hasMessaged) {
                selectedType = "view";
            } else if (hasLiked) {
                selectedType = roll < 0.6 ? "view" : "message";
            } else if (hasMessaged) {
                selectedType = roll < 0.6 ? "view" : "like";
            } else {
                if (isMaleToFemale) {
                    // HUGE probability increase for message if Male bot to Female user natively
                    if (roll < 0.8) selectedType = "message";
                    else if (roll < 0.9) selectedType = "like";
                    else selectedType = "view";
                } else {
                    if (roll < 0.5) selectedType = "view";
                    else if (roll < 0.8) selectedType = "like";
                    else selectedType = "message";
                }
            }

            console.log(`[OnlineEngagement BullMQ] User ${user._id} → ${selectedType} from bot ${bot._id}`);

            await botQueue.add(selectedType, {
                userId: user._id,
                botId: bot._id,
                activityType: selectedType,
                content: selectedType === "message" ? pick(GREETINGS) : undefined
            }, { delay: 0 });

            // Block future interaction for a variable window
            let nextGap;

            if (isPremium) {
                // Premium: 1-2 hours for likes, 2-3 hours for messages
                if (selectedType === "message") {
                    nextGap = randInt(120, 180); // 2-3 hours
                } else if (selectedType === "like") {
                    nextGap = randInt(60, 120); // 1-2 hours
                } else {
                    nextGap = randInt(30, 60); // Views every 30-60 mins
                }
            } else {
                nextGap = randInt(1, 15); // Normal: 1 to 15 minutes (online focus)
            }

            await redisConnection.setex(`bot:engagement:${user._id}`, nextGap * 60, "true");
        }
    } catch (error) {
        console.error("Error in processOnlineEngagement:", error);
    }
};

/**
 * Engage offline users with slow drip — views/likes every 1-4 hr, messages every 2-6 hr
 * Uses highly variable human-like timing
 */
const processOfflineEngagement = async () => {
    try {
        // Find offline normal users who haven't had activity recently
        const offlineUsers = await User.find({
            userType: "real",
            isProfileComplete: true,
            isOnline: false,
            lastActive: { $gte: new Date(Date.now() - 3 * 60 * 60 * 1000) } // Stop if away for > 3 hours
        });

        for (const user of offlineUsers) {
            // Check recent activity with variable window (1-4 hours)
            // Sometimes bots check back quickly, sometimes take longer
            const gapHours = Math.random() < 0.7 ? randInt(1, 2) : randInt(2, 4);
            const redisKey = `bot:offline_engagement:${user._id}`;
            const recentActivity = await redisConnection.get(redisKey);
            if (recentActivity) continue;

            const botGender = resolveBotGender(user);
            let bot;
            if (user.state) {
                bot = await User.findOne({ userType: "bot", gender: botGender, state: user.state });
            }
            if (!bot) {
                bot = await User.findOne({ userType: "bot", gender: botGender });
            }
            if (!bot) continue;

            const isPremium = hasPremiumAccess(user);
            // Lower interaction probability for premium users in offline loop too
            if (isPremium && Math.random() < 0.8) continue;


            // Check if bot has already liked this user (prevent duplicate likes)
            const hasLiked = await UserAction.findOne({
                userId: bot._id,
                targetUserId: user._id,
                actionType: "like"
            });

            // Check if bot has already messaged
            const hasMessaged = await hasBotMessagedUser(bot._id, user._id);

            // Weighted random based on what's already been done
            let roll = Math.random();
            let selectedType;

            const isMaleToFemale = String(botGender).toLowerCase() === "male" && String(user.gender).toLowerCase() === "female";

            if (hasLiked && hasMessaged) {
                selectedType = "view";
            } else if (hasLiked) {
                selectedType = roll < 0.6 ? "view" : "message";
            } else if (hasMessaged) {
                selectedType = roll < 0.6 ? "view" : "like";
            } else {
                if (isMaleToFemale) {
                    if (roll < 0.7) selectedType = "message";
                    else if (roll < 0.9) selectedType = "like";
                    else selectedType = "view";
                } else {
                    if (roll < 0.4) selectedType = "view";
                    else if (roll < 0.75) selectedType = "like";
                    else selectedType = "message";
                }
            }

            console.log(`[OfflineEngagement BullMQ] User ${user._id} → ${selectedType} from bot ${bot._id}`);

            await botQueue.add(selectedType, {
                userId: user._id,
                botId: bot._id,
                activityType: selectedType,
                content: selectedType === "message" ? pick(GREETINGS) : undefined
            }, { delay: 0 });

            // Block future interaction for a variable window
            let nextGap;

            if (isPremium) {
                if (selectedType === "message") {
                    nextGap = randInt(120, 240); // 2-4 hours
                } else if (selectedType === "like") {
                    nextGap = randInt(60, 180); // 1-3 hours
                } else {
                    nextGap = randInt(60, 120); // Views every 1-2 hours
                }
            } else {
                const cappedGapHours = Math.min(gapHours, 2);
                nextGap = cappedGapHours * 60; // Convert to minutes for consistent math
            }

            await redisConnection.setex(`bot:offline_engagement:${user._id}`, nextGap * 60, "true");
        }
    } catch (error) {
        console.error("Error in processOfflineEngagement:", error);
    }
};

/**
 * Natural bot online status update:
 * - 60% of bots online at any time
 * - Bots that were recently online tend to stay online longer
 * - Some bots go offline/online in waves for natural feel
 */
const updateBotOnlineStatus = async () => {
    try {
        console.log("🤖 Starting natural bot online status update...");

        const botUsers = await User.find({ userType: "bot" });

        if (botUsers.length === 0) {
            console.log("No bot users found");
            return;
        }

        const now = new Date();
        const hourOfDay = now.getHours();

        // Simulate higher activity during evening hours (6PM-12AM IST = 12:30-18:30 UTC)
        const isPeakHour = hourOfDay >= 12 && hourOfDay <= 19;
        const onlineProbability = isPeakHour ? 0.75 : 0.55;

        const updatePromises = botUsers.map(async (user) => {
            const wasOnline = user.isOnline;
            let isOnline;
            if (wasOnline) {
                isOnline = Math.random() < 0.8;
            } else {
                isOnline = Math.random() < onlineProbability;
            }

            return User.findByIdAndUpdate(user._id, {
                isOnline: isOnline,
                lastActive: isOnline ? new Date(now.getTime() - Math.floor(Math.random() * 10 * 60 * 1000)) : user.lastActive
            });
        });

        await Promise.all(updatePromises);

        const onlineCount = botUsers.filter(u => u.isOnline).length;
        console.log(`✅ Updated online status for ${botUsers.length} bots (${onlineCount} online, peak=${isPeakHour})`);
    } catch (error) {
        console.error("❌ Error updating bot online status:", error);
    }
};

/**
 * Fetch full bot profile if only skeleton ID was provided
 */
const getFullBot = async (bot) => {
    if (bot.profilePhotos && bot.name) return bot;
    return await User.findById(bot._id).select("name profilePhotos");
};

const executeView = async (user, bot) => {
    // 1. Fetch full bot data if missing (worker passes skeleton)
    const fullBot = await getFullBot(bot);
    if (!fullBot) return;

    const isPremium = hasPremiumAccess(user);
    const viewerName = isPremium ? fullBot.name : "Someone";
    const viewerPhoto = fullBot.profilePhotos?.[0]?.url;

    // Check if bot has ever viewed this user
    const existingView = await ProfileView.findOne({
        viewerId: fullBot._id,
        targetUserId: user._id
    });

    if (!existingView) {
        // First view - create new record
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
        // Revisit - update timestamp and send revisited notification
        const hoursSinceLastView = (Date.now() - existingView.viewedAt.getTime()) / (1000 * 60 * 60);

        // Only update and notify if at least 1 hour has passed (prevent spam)
        if (hoursSinceLastView >= 1) {
            existingView.viewedAt = new Date();
            await existingView.save();

            // Send "revisited" notification
            await createNotification(user._id, "revisit",
                isPremium ? `${viewerName} viewed you again 👀` : "Someone viewed you again 👀",
                isPremium ? "They came back to see your profile!" : "They came back to see your profile!",
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

    let finalContent = content;
    if (!content || content === "Hy") {
        finalContent = pick(GREETINGS);
    }

    console.log(`[BotInteraction] executeMessage: content="${finalContent}"`);

    // Check if bot has already messaged this user
    const hasMessagedBefore = await hasBotMessagedUser(fullBot._id, user._id);

    let match = await Match.findOne({
        $or: [
            { user1Id: user._id, user2Id: fullBot._id },
            { user1Id: fullBot._id, user2Id: user._id }
        ]
    });

    if (!match) {
        // First message - create new match
        console.log(`[BotInteraction] Creating new internal match for bot chat`);
        match = await Match.create({
            user1Id: fullBot._id,
            user2Id: user._id,
            status: "matched",
            mutualMatch: false,
            isApproved: false
        });
    } else if (hasMessagedBefore) {
        // Follow-up message in existing conversation - mark as revisited
        console.log(`[BotInteraction] Follow-up message from bot ${fullBot._id} to user ${user._id}`);
    }

    // Only create message if it's the first one OR if it's a follow-up (not duplicate first)
    if (!hasMessagedBefore || (hasMessagedBefore && match)) {
        await Message.create({
            matchId: match._id,
            senderId: fullBot._id,
            receiverId: user._id,
            content: finalContent
        });

        // Update match with revisit flag if this is a follow-up
        if (hasMessagedBefore) {
            await Match.findByIdAndUpdate(match._id, {
                $set: { lastMessageAt: new Date(), hasBotRevisited: true }
            });
        }

        await createNotification(user._id, "message",
            isPremium ? `New message from ${senderName}` : "New message received",
            isPremium ? finalContent : "Someone messaged you. Upgrade to chat back!",
            {
                type: "message",
                matchId: String(match._id),
                senderId: String(fullBot._id),
                senderName,
                senderPhoto,
                isLocked: String(!isPremium),
                isRevisit: hasMessagedBefore ? "true" : "false"
            });
    }
};

const cancelAllPending = async (userId) => {
    // BullMQ native cancellation flag using Redis memory lock (6 hours max)
    await redisConnection.setex(`bot:cancelled:${userId}`, 3600 * 6, "true");
};

/**
 * Handle reactive response when a real user likes a bot
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
            // Male User -> Female Bot (Girls rarely respond back)
            if (roll < 0.4) return; // 40% No response (None)

            if (roll < 0.7) {
                // 30% View only (1-5 min delay)
                await botQueue.add('view', { userId, botId, activityType: 'view' }, { delay: randInt(1, 5) * 60000 });
            } else {
                // 30% View + Like (Spread out)
                await botQueue.add('view', { userId, botId, activityType: 'view' }, { delay: randInt(1, 3) * 60000 });
                await botQueue.add('like', { userId, botId, activityType: 'like' }, { delay: randInt(4, 10) * 60000 });
            }
        }
        else if (isFemaleUser && isMaleBot) {
            // Female User -> Male Bot (Boys respond fast and message first)
            if (roll < 0.1) return; // 10% No response

            if (roll < 0.3) {
                // 20% View + Like
                await botQueue.add('view', { userId, botId, activityType: 'view' }, { delay: randInt(1, 2) * 60000 });
                await botQueue.add('like', { userId, botId, activityType: 'like' }, { delay: randInt(3, 5) * 60000 });
            } else {
                // 70% View + Like + Message ("Boys do first message")
                await botQueue.add('view', { userId, botId, activityType: 'view' }, { delay: randInt(1, 2) * 60000 });
                await botQueue.add('like', { userId, botId, activityType: 'like' }, { delay: randInt(3, 5) * 60000 });
                await botQueue.add('message', {
                    userId,
                    botId,
                    activityType: 'message',
                    content: pick(GREETINGS)
                }, { delay: randInt(6, 12) * 60000 });
            }
        }
    } catch (err) {
        console.error("Error in handleReactiveEngagement:", err);
    }
};

/**
 * Handle bot auto-reply to incoming user message (one-time)
 */
const handleBotReply = async (userId, botId, matchId) => {
    try {
        // Enforce one-reply limit per match
        const redisKey = `bot:replied:${matchId}`;
        const hasReplied = await redisConnection.get(redisKey);
        if (hasReplied) return;

        // Check if bot is online (simulating they saw the message)
        const bot = await User.findById(botId).select("isOnline");
        if (!bot || !bot.isOnline) return;

        console.log(`[BotReply] Scheduling reply for match ${matchId} (bot ${botId})`);

        // Schedule "Hy" or "Hello" with 2-3 min delay
        const reply = Math.random() < 0.5 ? "Hy" : "Hello";
        await botQueue.add('message', {
            userId,
            botId,
            activityType: 'message',
            content: reply
        }, { delay: randInt(2, 3) * 60000 });

        // Mark as replied (24h TTL)
        await redisConnection.setex(redisKey, 86400, "true");
    } catch (err) {
        console.error("Error in handleBotReply:", err);
    }
};

module.exports = {
    scheduleInitialActivity,
    processOnlineEngagement,
    processOfflineEngagement,
    updateBotOnlineStatus,
    cancelAllPending,
    executeView,
    executeLike,
    executeMessage,
    handleBotReply,
    handleReactiveEngagement
};
