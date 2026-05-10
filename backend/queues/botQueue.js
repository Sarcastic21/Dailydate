const { Queue } = require('bullmq');
const Redis = require('ioredis');

// Setup shared Redis connection to avoid overwhelming the server
const REDIS_URL = process.env.REDIS_URL;
const redisConnection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
});

// Single unified queue to reduce connection overhead
const botQueue = new Queue('botQueue', {
    connection: redisConnection,
    skipVersionCheck: true,
    defaultJobOptions: {
        removeOnComplete: { count: 10, age: 3600 }, // Aggressive cleanup: keep only 10 jobs for 1 hour
        removeOnFail: { count: 5, age: 3600 }, // Aggressive cleanup: keep only 5 failed jobs for 1 hour
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 }
    },
    limiter: {
        max: 50, // Max 50 jobs per second
        duration: 1000, // Per 1 second window
    }
});

module.exports = { botQueue, redisConnection };
