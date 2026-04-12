const { Worker } = require('bullmq');
const { redisConnection, botCronQueue, botQueue } = require('../queues/botQueue');
const { executeView, executeLike, executeMessage, processOnlineEngagement, processOfflineEngagement, updateBotOnlineStatus } = require('../services/botInteractionService');
const { accountDeletionJob } = require('../services/accountDeletionService');
const User = require('../models/User');

// Worker for immediate or delayed bot interactions (Views, Likes, Messages)
const interactionWorker = new Worker('botQueue', async (job) => {
    const { activityType, userId, botId, content } = job.data;

    // Verify user is still around and legit
    const user = await User.findById(userId);
    if (!user || user.accountType !== "normal" || !user.isProfileComplete) {
        console.log(`[BotWorker] Dropped job for ${userId}. user exists: ${!!user}, accountType: ${user?.accountType}, isProfileComplete: ${user?.isProfileComplete}`);
        return; // Job drops naturally
    }

    const isCancelled = await redisConnection.get(`bot:cancelled:${userId}`);
    if (isCancelled) {
        console.log(`[BotWorker] Dropped job for ${userId} because of bot:cancelled flag.`);
        return; // Drop explicitly cancelled jobs instantly
    }

    try {
        console.log(`[BotWorker] Executing ${activityType} for user ${userId} via bot ${botId}`);
        if (activityType === 'view') {
            await executeView(user, { _id: botId });
        } else if (activityType === 'like') {
            await executeLike(user, { _id: botId });
        } else if (activityType === 'message') {
            await executeMessage(user, { _id: botId }, content);
        }
    } catch (err) {
        console.error(`❌ Failed to execute ${activityType}:`, err);
        throw err;
    }
}, { connection: redisConnection, concurrency: 50, skipVersionCheck: true }); // High concurrency for 1000+ users!

// Worker for cron-like constant polling
const cronWorker = new Worker('botCronQueue', async (job) => {
    if (job.name === 'onlineEngagement') {
        await processOnlineEngagement();
    } else if (job.name === 'offlineEngagement') {
        await processOfflineEngagement();
    } else if (job.name === 'botOnlineStatus') {
        await updateBotOnlineStatus();
    } else if (job.name === 'accountDeletion') {
        await accountDeletionJob();
    }
}, { connection: redisConnection, skipVersionCheck: true });

// Setup the repeatable cron jobs natively using BullMQ
const setupCrons = async () => {
    try {
        await botCronQueue.add('onlineEngagement', {}, {
            repeat: { every: 60000 }, // Every 1 minute
            jobId: 'onlineEngagementJob'
        });

        await botCronQueue.add('offlineEngagement', {}, {
            repeat: { every: 1800000 }, // Every 30 minutes
            jobId: 'offlineEngagementJob'
        });

        await botCronQueue.add('botOnlineStatus', {}, {
            repeat: { every: 600000 }, // Every 10 minutes
            jobId: 'botOnlineStatusJob'
        });

        await botCronQueue.add('accountDeletion', {}, {
            repeat: { pattern: '0 3 * * *' }, // 3 AM daily
            jobId: 'accountDeletionJob'
        });

        console.log("🤖 BullMQ Workers Initialized: botQueue and botCronQueue deployed successfully!");
    } catch (err) {
        console.error("Failed to inject cron jobs into botCronQueue", err);
    }
}

setupCrons();

// Auto-cleanup completed jobs to save memory
interactionWorker.on('completed', async (job) => {
    try {
        await job.remove();
    } catch (e) {
        // Ignore errors - job might already be removed
    }
});

interactionWorker.on('failed', async (job) => {
    if (job && job.attemptsMade >= (job.opts.attempts || 2)) {
        try {
            await job.remove();
        } catch (e) {
            // Ignore
        }
    }
});

// Clean up cron job instances immediately after completion
cronWorker.on('completed', async (job) => {
    try {
        await job.remove();
    } catch (e) {
        // Ignore
    }
});

module.exports = { interactionWorker, cronWorker };
