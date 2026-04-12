const User = require("../models/User");
const { redisConnection } = require("../queues/botQueue");

/**
 * Clean up Redis keys for a user being deleted
 * Removes pending bot engagement jobs
 */
const cleanupUserRedisKeys = async (userId) => {
    try {
        // Remove bot engagement keys for this user
        const engagementKey = `bot:engagement:${userId}`;
        const offlineKey = `bot:offline_engagement:${userId}`;
        const cancelledKey = `bot:cancelled:${userId}`;

        await redisConnection.del(engagementKey, offlineKey, cancelledKey);

        // Note: BullMQ jobs with delay can't be easily removed by userId
        // They will be dropped when executed (as seen in logs)
        // This cleans up the Redis state tracking
    } catch (err) {
        console.error(`Failed to cleanup Redis for user ${userId}:`, err.message);
    }
};

/**
 * Permanent account deletion job
 * Deletes users who requested deletion more than 48 hours ago
 */
const accountDeletionJob = async () => {
    try {
        console.log("🧹 Running scheduled account deletion job...");

        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

        // Find users scheduled for deletion (48+ hours ago)
        const usersToDelete = await User.find({
            deletionRequestedAt: { $lte: fortyEightHoursAgo }
        });

        if (usersToDelete.length === 0) {
            console.log("ℹ️ No accounts eligible for permanent deletion.");
            return;
        }

        // Clean up Redis keys for each user before deletion
        for (const user of usersToDelete) {
            await cleanupUserRedisKeys(user._id.toString());
        }

        // Mark as deactivated before deletion (for tracking)
        await User.updateMany(
            { _id: { $in: usersToDelete.map(u => u._id) } },
            { isDeactivated: true }
        );

        // Permanently delete accounts
        const result = await User.deleteMany({
            _id: { $in: usersToDelete.map(u => u._id) }
        });

        console.log(`✅ Permanently deleted ${result.deletedCount} accounts that were scheduled for deletion.`);
    } catch (error) {
        console.error("❌ Error in account deletion job:", error);
    }
};

module.exports = { accountDeletionJob };
