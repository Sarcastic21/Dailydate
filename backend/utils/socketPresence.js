/**
 * Whether the user has at least one Socket.IO connection registered in Redis.
 * Used to decide in-app realtime vs FCM + persisted notification.
 */
async function hasActiveSocket(redisClient, userId) {
    if (!redisClient || userId == null) return false;
    try {
        const ids = await redisClient.sMembers(`user:sockets:${String(userId)}`);
        return Array.isArray(ids) && ids.length > 0;
    } catch {
        return false;
    }
}

module.exports = { hasActiveSocket };
