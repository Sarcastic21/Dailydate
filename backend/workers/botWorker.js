const { Worker } = require('bullmq');
const { redisConnection, botQueue } = require('../queues/botQueue');
const { executeView, executeLike, executeMessage, processOnlineEngagement, processOfflineEngagement, processMessageEngagement, updateBotOnlineStatus } = require('../services/botInteractionService');
const { accountDeletionJob } = require('../services/accountDeletionService');
const User = require('../models/User');

// Worker for immediate or delayed bot interactions (Views, Likes, Messages)
const interactionWorker = new Worker('botQueue', async (job) => {
    const { activityType, userId, botId, content } = job.data;

    // Verify user is still around and legit
    const user = await User.findById(userId);
    if (!user || user.userType !== "real" || !user.isProfileComplete) {
        console.log(`[BotWorker] Dropped job for ${userId}. user exists: ${!!user}, userType: ${user?.userType}, isProfileComplete: ${user?.isProfileComplete}`);
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
        } else if (activityType === 'onlineEngagement') {
            await processOnlineEngagement();
        } else if (activityType === 'offlineEngagement') {
            await processOfflineEngagement();
        } else if (activityType === 'messageEngagement') {
            await processMessageEngagement();
        } else if (activityType === 'botOnlineStatus') {
            await updateBotOnlineStatus();
        } else if (activityType === 'accountDeletion') {
            await accountDeletionJob();
        }
    } catch (err) {
        console.error(`❌ Failed to execute ${activityType}:`, err);
        throw err;
    }
}, { connection: redisConnection, concurrency: 10, skipVersionCheck: true }); // Reduced concurrency from 50 to 10

// Setup the repeatable cron jobs natively using BullMQ (single queue)
const setupCrons = async () => {
    try {
        // REDUCED FREQUENCY: Every 10 minutes instead of 1 minute
        await botQueue.add('onlineEngagement', {}, {
            repeat: { every: 600000 }, // Every 10 minutes (was 1 minute)
            jobId: 'onlineEngagementJob'
        });

        // REDUCED FREQUENCY: Every 1 hour instead of 30 minutes
        await botQueue.add('offlineEngagement', {}, {
            repeat: { every: 3600000 }, // Every 1 hour (was 30 minutes)
            jobId: 'offlineEngagementJob'
        });

        // KEPT: Every 10 minutes
        await botQueue.add('botOnlineStatus', {}, {
            repeat: { every: 600000 }, // Every 10 minutes
            jobId: 'botOnlineStatusJob'
        });

        // KEPT: Every 10 minutes
        await botQueue.add('messageEngagement', {}, {
            repeat: { every: 600000 }, // Every 10 minutes
            jobId: 'messageEngagementJob'
        });

        // KEPT: 3 AM daily
        await botQueue.add('accountDeletion', {}, {
            repeat: { pattern: '0 3 * * *' }, // 3 AM daily
            jobId: 'accountDeletionJob'
        });

        console.log("🤖 BullMQ Worker Initialized: Single botQueue with optimized cron frequencies!");
    } catch (err) {
        console.error("Failed to inject cron jobs into botQueue", err);
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

module.exports = { interactionWorker };
