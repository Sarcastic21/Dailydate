const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL;

const redisClient = createClient({
    url: REDIS_URL
});

redisClient.on('error', (err) => console.error('❌ Redis Client Error', err));
redisClient.on('connect', () => console.log('✅ Redis Client Connected'));

(async () => {
    await redisClient.connect();
})();

module.exports = redisClient;
