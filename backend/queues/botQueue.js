const { Queue } = require('bullmq');
const Redis = require('ioredis');

// Setup shared Redis connection to avoid overwhelming the server
const REDIS_URL = process.env.REDIS_URL;
const redisConnection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
});

// botQueue for handling immediate and delayed interactive events like views, likes, and messages
const botQueue = new Queue('botQueue', {
    connection: redisConnection,
    skipVersionCheck: true,
    defaultJobOptions: {
        removeOnComplete: { count: 100 }, // Keep only last 100 completed jobs
        removeOnFail: { count: 50 }, // Keep only last 50 failed jobs
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 }
    }
});

// Cron queue for repetitive large checks
const botCronQueue = new Queue('botCronQueue', {
    connection: redisConnection,
    skipVersionCheck: true,
    defaultJobOptions: {
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 }
    }
});

module.exports = { botQueue, botCronQueue, redisConnection };
