const Redis = require('redis');
const Report = require('../models/Report');

/**
 * Rate Limiting Middleware for Report Creation
 * Limits number of reports per user per day
 */

class RateLimitService {
    constructor() {
        // Initialize Redis client if available, otherwise use database fallback
        try {
            this.redisClient = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD || undefined
            });

            this.redisClient.on('error', (err) => {
                console.log('Redis Client Error - falling back to database:', err);
                this.redisClient = null;
            });

            this.redisClient.on('connect', () => {
                console.log('Redis connected for rate limiting');
            });
        } catch (error) {
            console.log('Redis not available, using database for rate limiting');
            this.redisClient = null;
        }
    }

    /**
     * Check rate limit using Redis (fast)
     */
    async checkRateLimitRedis(userId, dailyLimit = 5) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const key = `rate_limit:${userId}:${today}`;
            
            const current = await this.redisClient.get(key);
            const currentCount = parseInt(current) || 0;

            if (currentCount >= dailyLimit) {
                return {
                    allowed: false,
                    remaining: 0,
                    resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    currentCount
                };
            }

            // Increment counter
            await this.redisClient.incr(key);
            await this.redisClient.expire(key, 24 * 60 * 60); // 24 hours

            return {
                allowed: true,
                remaining: dailyLimit - (currentCount + 1),
                resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                currentCount: currentCount + 1
            };
        } catch (error) {
            console.error('Redis rate limit error:', error);
            // Fallback to database
            return this.checkRateLimitDatabase(userId, dailyLimit);
        }
    }

    /**
     * Check rate limit using database (fallback)
     */
    async checkRateLimitDatabase(userId, dailyLimit = 5) {
        try {
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

            const todayReportsCount = await Report.countDocuments({
                userId: userId,
                createdAt: {
                    $gte: startOfDay,
                    $lt: endOfDay
                }
            });

            return {
                allowed: todayReportsCount < dailyLimit,
                remaining: Math.max(0, dailyLimit - todayReportsCount),
                resetTime: endOfDay,
                currentCount: todayReportsCount
            };
        } catch (error) {
            console.error('Database rate limit error:', error);
            // In case of error, allow the request (fail open)
            return {
                allowed: true,
                remaining: dailyLimit - 1,
                resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                currentCount: 0
            };
        }
    }

    /**
     * Main rate limiting check
     */
    async checkRateLimit(userId, dailyLimit = 5) {
        if (this.redisClient) {
            return this.checkRateLimitRedis(userId, dailyLimit);
        } else {
            return this.checkRateLimitDatabase(userId, dailyLimit);
        }
    }
}

/**
 * Express middleware for rate limiting reports
 */
const rateLimitReports = (dailyLimit = 5) => {
    const rateLimitService = new RateLimitService();

    return async (req, res, next) => {
        try {
            // Get user ID from authenticated user or request body
            const userId = (req.user && req.user._id) || req.body.userId;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'User authentication required for rate limiting'
                });
            }

            const rateLimitResult = await rateLimitService.checkRateLimit(userId, dailyLimit);

            // Set rate limit headers
            res.set({
                'X-RateLimit-Limit': dailyLimit,
                'X-RateLimit-Remaining': rateLimitResult.remaining,
                'X-RateLimit-Reset': rateLimitResult.resetTime.toISOString()
            });

            if (!rateLimitResult.allowed) {
                return res.status(429).json({
                    success: false,
                    message: `Rate limit exceeded. You can only submit ${dailyLimit} reports per day.`,
                    rateLimitInfo: {
                        limit: dailyLimit,
                        remaining: rateLimitResult.remaining,
                        resetTime: rateLimitResult.resetTime,
                        currentCount: rateLimitResult.currentCount
                    }
                });
            }

            // Attach rate limit info to request for potential use in controller
            req.rateLimitInfo = rateLimitResult;
            next();
        } catch (error) {
            console.error('Rate limiting middleware error:', error);
            // In case of error, allow the request (fail open)
            next();
        }
    };
};

/**
 * Device-based rate limiting (additional security layer)
 */
const rateLimitDevices = (dailyLimit = 10) => {
    const rateLimitService = new RateLimitService();

    return async (req, res, next) => {
        try {
            // Get device identifier from headers
            const deviceId = req.headers['x-device-id'] || 
                           req.headers['user-agent'] || 
                           req.ip;

            if (!deviceId) {
                return next(); // Skip if no device identifier
            }

            const deviceRateLimit = await rateLimitService.checkRateLimit(
                `device:${deviceId}`, 
                dailyLimit
            );

            if (!deviceRateLimit.allowed) {
                return res.status(429).json({
                    success: false,
                    message: `Device rate limit exceeded. Maximum ${dailyLimit} reports per device per day.`,
                    rateLimitInfo: {
                        type: 'device',
                        limit: dailyLimit,
                        remaining: deviceRateLimit.remaining,
                        resetTime: deviceRateLimit.resetTime
                    }
                });
            }

            next();
        } catch (error) {
            console.error('Device rate limiting error:', error);
            next();
        }
    };
};

module.exports = {
    RateLimitService,
    rateLimitReports,
    rateLimitDevices
};