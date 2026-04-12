/**
 * Push a Socket.IO event to all connections registered for a user (Redis set user:sockets:id).
 */
async function emitToUserSockets(io, redisClient, userId, event, payload) {
    try {
        if (!io || !redisClient || userId == null) return;
        const key = `user:sockets:${String(userId)}`;
        const ids = await redisClient.sMembers(key);
        if (!ids?.length) return;
        ids.forEach((sid) => io.to(sid).emit(event, payload));
    } catch (e) {
        console.error(`emitToUserSockets ${event}:`, e.message);
    }
}

module.exports = { emitToUserSockets };
