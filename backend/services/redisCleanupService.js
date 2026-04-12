const { redisConnection } = require('../queues/botQueue');

/**
 * Redis Cleanup Service - Optimizes memory usage for 30MB free tier
 * Runs periodically to clean up orphaned keys and old BullMQ data
 */

const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // Every 30 minutes

const runRedisCleanup = async () => {
    try {
        console.log('🧹 Starting Redis cleanup search...');
        let cleanedCount = 0;
        let checkedCount = 0;
        const now = Date.now();

        // 1. Clean up orphaned bot engagement keys
        const botKeys = await redisConnection.keys('bot:*');
        checkedCount += botKeys.length;
        for (const key of botKeys) {
            const ttl = await redisConnection.ttl(key);
            if (ttl === -1) {
                await redisConnection.del(key);
                cleanedCount++;
            }
        }

        // 2. Socket keys with valid TTL are left alone
        const socketKeys = await redisConnection.keys('user:sockets:*');
        checkedCount += socketKeys.length;
        for (const key of socketKeys) {
            const ttl = await redisConnection.ttl(key);
            const type = await redisConnection.type(key);

            if (ttl === -1) {
                await redisConnection.expire(key, 3600);
                cleanedCount++;
            } else if (ttl === -2) {
                await redisConnection.del(key);
                cleanedCount++;
            } else if (type === 'set') {
                const size = await redisConnection.scard(key);
                if (size === 0) {
                    await redisConnection.del(key);
                    cleanedCount++;
                }
            }
        }

        // 3. Clean BullMQ old completed/failed jobs
        const queues = ['botQueue', 'botCronQueue'];
        for (const q of queues) {
            const completedKey = `bull:${q}:completed`;
            const failedKey = `bull:${q}:failed`;

            const completedCount = await redisConnection.zcard(completedKey);
            checkedCount += completedCount;
            if (completedCount > 100) {
                await redisConnection.zremrangebyrank(completedKey, 0, completedCount - 101);
                cleanedCount += (completedCount - 100);
            }

            const failedCount = await redisConnection.zcard(failedKey);
            checkedCount += failedCount;
            if (failedCount > 50) {
                await redisConnection.zremrangebyrank(failedKey, 0, failedCount - 51);
                cleanedCount += (failedCount - 50);
            }
        }

        // 4. Clean old socket.io data
        const socketKeysMeta = await redisConnection.keys('socket.io:*');
        checkedCount += socketKeysMeta.length;
        for (const key of socketKeysMeta) {
            const ttl = await redisConnection.ttl(key);
            if (ttl === -1) {
                const type = await redisConnection.type(key);
                let canDelete = false;
                if (type === 'set') canDelete = (await redisConnection.scard(key)) === 0;
                else if (type === 'hash') canDelete = (await redisConnection.hlen(key)) === 0;

                if (canDelete) {
                    await redisConnection.del(key);
                    cleanedCount++;
                } else if (key.includes('room:')) {
                    await redisConnection.expire(key, 7200); // 2 hours
                }
            }
        }

        // 5. Memory reporting and stats
        const info = await redisConnection.info('memory');
        const usedMemory = info.match(/used_memory_human:(.+)/)?.[1]?.trim() || 'unknown';
        const peakMemory = info.match(/used_memory_peak_human:(.+)/)?.[1]?.trim() || 'unknown';
        const luaMemory = info.match(/used_memory_lua_human:(.+)/)?.[1]?.trim() || '0';

        console.log(`✅ Redis cleanup: Scanned ${checkedCount} keys, Purged ${cleanedCount} stale items.`);
        console.log(`📊 Redis Stats: Used: ${usedMemory}, Peak: ${peakMemory}, Lua: ${luaMemory}`);
    } catch (error) {
        console.error('❌ Redis cleanup error:', error.message);
    }
};

// Start cleanup loop
const startCleanupLoop = () => {
    console.log('🔄 Redis cleanup service started (runs every 30 min)');
    runRedisCleanup(); // Run immediately on startup
    setInterval(runRedisCleanup, CLEANUP_INTERVAL_MS);
};

module.exports = { startCleanupLoop, runRedisCleanup };
