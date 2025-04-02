import redis from 'redis';
import 'dotenv/config';

const redisClient = redis.createClient({
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
    },
});

redisClient.on('connect', () => {
    console.log('Redis client connected successfully (ESM)');
});

redisClient.on('error', (err) => {
    console.error('Redis Connection Error:', err);
});

const connectRedis = async () => {
    try {
        await redisClient.connect(); // Connect needed for v4+
    } catch (err) {
         console.error('Failed to connect to Redis:', err);
    }
};

// Export named variables
export { redisClient, connectRedis };