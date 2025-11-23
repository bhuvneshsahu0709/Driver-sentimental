const express = require('express');
const cors = require('cors');
const { Redis } = require('@upstash/redis');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Upstash Redis REST API client
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('Upstash Redis credentials are not set in the environment variables. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your .env file.');
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Test Redis connection
(async () => {
  try {
    const result = await redis.ping();
    if (result === 'PONG') {
      console.log('✅ Upstash Redis connection test successful');
    }
  } catch (error) {
    console.error('');
    console.error('❌ Upstash Redis connection test failed:', error.message);
    console.error('');
    console.error('💡 Please check your .env file:');
    console.error('   - UPSTASH_REDIS_REST_URL should be set');
    console.error('   - UPSTASH_REDIS_REST_TOKEN should be set');
    console.error('   Get these from: https://console.upstash.com/ → Your Database → REST API');
    console.error('');
    console.error('⚠️  The application will continue but Redis features may not work');
    console.error('');
  }
})();

// Initialize MongoDB connection for analytics
let mongoClient;
let mongoDb;
(async () => {
  // MongoDB Atlas connection string
  const mongoUri = process.env.MONGO_URI || 'mongodb+srv://bhuvnesh:bhuvnesh@cluster0.nm7zbfj.mongodb.net/movesync';
  
  // Mask password in logs
  let maskedUri = mongoUri;
  if (mongoUri.includes('@')) {
    const parts = mongoUri.split('@');
    if (parts[0].includes('://')) {
      const protocolUser = parts[0].split('://');
      if (protocolUser[1].includes(':')) {
        const userPass = protocolUser[1].split(':');
        maskedUri = `${protocolUser[0]}://${userPass[0]}:***@${parts[1]}`;
      }
    }
  }
  
  try {
    console.log('='.repeat(60));
    console.log('🔄 Attempting MongoDB Atlas connection...');
    console.log(`Database: movesync`);
    console.log(`MongoDB URI: ${maskedUri}`);
    
    mongoClient = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 20000,
    });
    
    await mongoClient.connect();
    mongoDb = mongoClient.db('movesync');
    
    // Test connection with a simple operation
    console.log('Testing connection with ping...');
    await mongoDb.command({ ping: 1 });
    
    // Test by checking collection
    try {
      const testCollection = mongoDb.collection('feedback');
      const count = await testCollection.countDocuments({});
      console.log(`✅ Connected to MongoDB Atlas - Database: movesync, Found ${count} feedback documents`);
    } catch (countError) {
      console.log(`✅ Connected to MongoDB Atlas - Database: movesync (count check failed: ${countError.message})`);
    }
    console.log('='.repeat(60));
  } catch (error) {
    console.error('='.repeat(60));
    console.error('❌ MongoDB Atlas Connection Failed!');
    console.error('='.repeat(60));
    console.error(`Error Type: ${error.constructor.name}`);
    console.error(`Error Message: ${error.message}`);
    console.error(`MongoDB URI: ${maskedUri}`);
    console.error('');
    console.error('🔍 Common MongoDB Atlas Connection Issues:');
    console.error('');
    console.error('1. IP ADDRESS NOT WHITELISTED (Most Common)');
    console.error('   → Go to MongoDB Atlas Dashboard');
    console.error('   → Network Access → Add IP Address');
    console.error('   → Click "Add Current IP Address" or "Allow Access from Anywhere" (0.0.0.0/0)');
    console.error('   → Wait 1-2 minutes for changes to propagate');
    console.error('');
    console.error('2. INCORRECT USERNAME OR PASSWORD');
    console.error('   → Check Database Access in Atlas');
    console.error('   → Verify username: bhuvnesh');
    console.error('   → Reset password if needed');
    console.error('   → URL encode special characters in password (@ = %40, # = %23, etc.)');
    console.error('');
    console.error('3. DATABASE USER PERMISSIONS');
    console.error('   → Go to Database Access');
    console.error('   → Ensure user has "Read and write to any database" or "Atlas admin" role');
    console.error('');
    console.error('4. NETWORK/FIREWALL ISSUES');
    console.error('   → Check if your network blocks port 27017');
    console.error('   → Try from a different network');
    console.error('   → Check corporate firewall settings');
    console.error('');
    console.error('5. CONNECTION STRING FORMAT');
    console.error('   → Ensure connection string includes database name: /movesync');
    console.error('   → Format: mongodb+srv://user:pass@cluster.mongodb.net/dbname?options');
    console.error('');
    console.error('💡 Quick Test:');
    console.error('   Try connecting from MongoDB Compass or mongosh:');
    console.error(`   ${maskedUri}`);
    console.error('='.repeat(60));
    console.log('⚠️  Analytics endpoints will be unavailable until MongoDB is connected');
  }
})();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files for UI

// Feature flags configuration (stored in Redis for real-time updates)
const getFeatureFlags = async () => {
  try {
    // Get all feature flags at once
    const [driver, trip, mobile, marshal] = await Promise.all([
      redis.get('feature:driver:enabled'),
      redis.get('feature:trip:enabled'),
      redis.get('feature:mobile:enabled'),
      redis.get('feature:marshal:enabled')
    ]);
    
    // Upstash Redis returns null if key doesn't exist, or the string value if it exists
    // Convert to boolean: 'true' string = true, 'false' string = false, null = true (default enabled)
    return {
      driver: driver === null || driver === 'true' || driver === true,
      trip: trip === null || trip === 'true' || trip === true,
      mobile: mobile === null || mobile === 'true' || mobile === true,
      marshal: marshal === null || marshal === 'true' || marshal === true,
    };
  } catch (error) {
    console.error('Error getting feature flags:', error);
    // Fallback to defaults if Redis unavailable
    return {
      driver: true,
      trip: true,
      mobile: true,
      marshal: true,
    };
  }
};

// Initialize feature flags in Redis (if not set)
(async () => {
  try {
    const driver = await redis.get('feature:driver:enabled');
    if (driver === null) await redis.set('feature:driver:enabled', 'true');
    
    const trip = await redis.get('feature:trip:enabled');
    if (trip === null) await redis.set('feature:trip:enabled', 'true');
    
    const mobile = await redis.get('feature:mobile:enabled');
    if (mobile === null) await redis.set('feature:mobile:enabled', 'true');
    
    const marshal = await redis.get('feature:marshal:enabled');
    if (marshal === null) await redis.set('feature:marshal:enabled', 'true');
  } catch (error) {
    console.log('Could not initialize feature flags in Redis');
  }
})();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'api-service' });
});

// Get feature flags configuration
app.get('/api/config/features', async (req, res) => {
  try {
    const features = await getFeatureFlags();
    res.json({ features });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch feature flags' });
  }
});

// Update feature flags
app.put('/api/config/features', async (req, res) => {
  try {
    const { features } = req.body;
    
    if (!features || typeof features !== 'object') {
      return res.status(400).json({ error: 'Invalid request body. Expected { features: { driver: boolean, ... } }' });
    }
    
    // Update each feature flag that was provided
    const updatePromises = [];
    
    if (features.driver !== undefined) {
      updatePromises.push(redis.set('feature:driver:enabled', features.driver ? 'true' : 'false'));
    }
    if (features.trip !== undefined) {
      updatePromises.push(redis.set('feature:trip:enabled', features.trip ? 'true' : 'false'));
    }
    if (features.mobile !== undefined) {
      updatePromises.push(redis.set('feature:mobile:enabled', features.mobile ? 'true' : 'false'));
    }
    if (features.marshal !== undefined) {
      updatePromises.push(redis.set('feature:marshal:enabled', features.marshal ? 'true' : 'false'));
    }
    
    // Wait for all updates to complete
    await Promise.all(updatePromises);
    
    // Get updated feature flags
    const updatedFeatures = await getFeatureFlags();
    
    console.log(`✅ Feature flags updated:`, updatedFeatures);
    
    res.json({ 
      features: updatedFeatures, 
      message: 'Feature flags updated successfully' 
    });
  } catch (error) {
    console.error('❌ Error updating feature flags:', error);
    res.status(500).json({ 
      error: 'Failed to update feature flags',
      details: error.message 
    });
  }
});

/**
 * POST /feedback
 * Accepts feedback from riders and queues it for sentiment processing
 * 
 * Request Body:
 * {
 *   "driverId": "string",
 *   "tripId": "string",
 *   "comment": "string",
 *   "type": "driver" | "trip" | "app" | "marshal"
 * }
 * 
 * Returns: HTTP 202 Accepted
 */
app.post('/feedback', async (req, res) => {
  try {
    const { driverId, tripId, comment, type } = req.body;

    // Basic validation - driverId is optional for non-driver feedback
    if (!comment || !type) {
      return res.status(400).json({
        error: 'Missing required fields: comment and type are required',
      });
    }
    
    // driverId is required only for driver and trip types
    if ((type === 'driver' || type === 'trip') && !driverId) {
      return res.status(400).json({
        error: 'Missing required field: driverId is required for driver and trip feedback',
      });
    }

    // Validate type (support both 'app' and 'mobile' for backward compatibility)
    const validTypes = ['driver', 'trip', 'app', 'mobile', 'marshal'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      });
    }
    
    // Check feature flags - reject if the feedback type is disabled
    const featureFlags = await getFeatureFlags();
    const feedbackType = type === 'mobile' ? 'mobile' : type;
    
    if (!featureFlags[feedbackType]) {
      return res.status(403).json({
        error: `${feedbackType.charAt(0).toUpperCase() + feedbackType.slice(1)} feedback is currently disabled`,
        message: 'This feedback type has been disabled by an administrator',
      });
    }
    
    // Normalize 'mobile' to 'app' for backend processing
    const normalizedType = type === 'mobile' ? 'app' : type;

    // Get additional metadata from request body
    const { metadata = {} } = req.body;
    
    // Create job payload
    const jobData = {
      driverId,
      tripId: tripId || null,
      comment,
      type: normalizedType,
      metadata,
      timestamp: new Date().toISOString(),
    };

    // Push to Redis list for Python worker
    await redis.lpush('sentiment_feedback_queue', JSON.stringify(jobData));
    
    // Log for debugging
    console.log(`[Feedback] ✅ Queued feedback - Type: ${type}, DriverId: ${driverId || 'N/A'}, Comment length: ${comment.length}`);
    console.log(`[Feedback] Queue name: sentiment_feedback_queue`);
    
    // Check queue length
    const queueLength = await redis.llen('sentiment_feedback_queue');
    console.log(`[Feedback] Current queue length: ${queueLength}`);

    // Return 202 Accepted - request is queued for processing
    res.status(202).json({
      message: 'Feedback received and queued for processing',
      driverId: driverId || null,
      type,
      queueLength,
    });
  } catch (error) {
    console.error('Error queuing feedback:', error);
    res.status(500).json({
      error: 'Internal server error while queuing feedback',
      message: error.message,
    });
  }
});

// Get driver score
app.get('/api/drivers/:driverId/score', async (req, res) => {
  try {
    const { driverId } = req.params;
    const scoreKey = `driver_score:${driverId}`;
    const score = await redis.get(scoreKey);
    
    if (score === null) {
      return res.status(404).json({ error: 'Driver score not found' });
    }
    
    res.json({
      driverId,
      score: parseFloat(score),
      threshold: parseFloat(process.env.SENTIMENT_THRESHOLD || '2.5'),
    });
  } catch (error) {
    console.error('Error fetching driver score:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all driver scores
app.get('/api/drivers/scores', async (req, res) => {
  try {
    const keys = await redis.keys('driver_score:*');
    const scores = [];
    const threshold = parseFloat(process.env.SENTIMENT_THRESHOLD || '2.5');
    
    for (const key of keys) {
      const driverId = key.replace('driver_score:', '');
      const score = await redis.get(key);
      const scoreValue = parseFloat(score);
      
      // Check if driver has active alert (score below threshold)
      const cooldownKey = `alert_cooldown:${driverId}`;
      const hasCooldown = await redis.exists(cooldownKey);
      const isAlerting = scoreValue < threshold;
      
      scores.push({
        driverId,
        score: scoreValue,
        isAlerting,
        hasActiveAlert: isAlerting && hasCooldown === 1, // Alert was triggered (cooldown active)
      });
    }
    
    // Sort by score (lowest first - most concerning)
    scores.sort((a, b) => a.score - b.score);
    
    res.json({ drivers: scores });
  } catch (error) {
    console.error('Error fetching driver scores:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get active alerts (drivers with score below threshold)
app.get('/api/alerts', async (req, res) => {
  try {
    const threshold = parseFloat(process.env.SENTIMENT_THRESHOLD || '2.5');
    const keys = await redis.keys('driver_score:*');
    const alerts = [];
    
    for (const key of keys) {
      const driverId = key.replace('driver_score:', '');
      const score = await redis.get(key);
      const scoreValue = parseFloat(score);
      
      // Only include drivers with score below threshold
      if (scoreValue < threshold) {
        const cooldownKey = `alert_cooldown:${driverId}`;
        const cooldownExists = await redis.exists(cooldownKey);
        const ttl = cooldownExists === 1 ? await redis.ttl(cooldownKey) : -1;
        
        alerts.push({
          driverId,
          score: scoreValue,
          threshold,
          alertTriggered: cooldownExists === 1, // True if alert was recently triggered
          cooldownRemaining: ttl > 0 ? ttl : null, // Seconds remaining in cooldown
          cooldownMinutes: ttl > 0 ? Math.ceil(ttl / 60) : null, // Minutes remaining
        });
      }
    }
    
    // Sort by score (lowest first - most critical)
    alerts.sort((a, b) => a.score - b.score);
    
    res.json({ 
      alerts,
      total: alerts.length,
      threshold 
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get feedback analytics
app.get('/api/analytics/feedback', async (req, res) => {
  try {
    if (!mongoDb) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }
    
    const collection = mongoDb.collection('feedback');
    const { type, driverId, limit = 1000 } = req.query;
    
    // Debug: Check total count first
    try {
      const totalCount = await collection.countDocuments({});
      console.log(`[Analytics] Total feedback documents in MongoDB: ${totalCount}`);
      
      if (totalCount === 0) {
        console.log('[Analytics] WARNING: No feedback documents found in MongoDB');
        console.log('[Analytics] Check if worker is processing and storing feedback');
      }
    } catch (countError) {
      console.error('[Analytics] Error counting documents:', countError);
    }
    
    const query = {};
    if (type) {
      // Normalize 'mobile' to 'app' for database query
      query.type = type === 'mobile' ? 'app' : type;
      console.log(`[Analytics] Filtering by type: ${type} (query: ${query.type})`);
    }
    if (driverId) query.driverId = driverId;
    
    const feedback = await collection
      .find(query)
      .sort({ processed_at: -1 })
      .limit(parseInt(limit))
      .toArray();
    
    console.log(`[Analytics] Found ${feedback.length} feedback documents matching query`);
    
    // Calculate statistics
    const stats = {
      total: feedback.length,
      byType: {},
      averageSentiment: 0,
      averageScore: 0,
      drivers: new Set(),
      trips: new Set(),
    };
    
    let totalSentiment = 0;
    let totalScore = 0;
    let scoreCount = 0;
    
    feedback.forEach((item) => {
      // Count by type (normalize 'app' to 'mobile' for display)
      const displayType = item.type === 'app' ? 'mobile' : item.type;
      stats.byType[displayType] = (stats.byType[displayType] || 0) + 1;
      
      // Track drivers and trips
      if (item.driverId) stats.drivers.add(item.driverId);
      if (item.tripId) stats.trips.add(item.tripId);
      
      // Sum for averages
      if (item.sentiment_score !== undefined && item.sentiment_score !== null) {
        totalSentiment += item.sentiment_score;
      }
      if (item.driver_ema_score !== undefined && item.driver_ema_score !== null) {
        totalScore += item.driver_ema_score;
        scoreCount++;
      }
    });
    
    stats.averageSentiment = feedback.length > 0 ? totalSentiment / feedback.length : 0;
    stats.averageScore = scoreCount > 0 ? totalScore / scoreCount : 0;
    stats.uniqueDrivers = stats.drivers.size;
    stats.uniqueTrips = stats.trips.size;
    delete stats.drivers;
    delete stats.trips;
    
    console.log(`[Analytics] Returning statistics: total=${stats.total}, drivers=${stats.uniqueDrivers}, trips=${stats.uniqueTrips}, byType=`, stats.byType);
    
    res.json({
      feedback,
      statistics: stats,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      feedback: [],
      statistics: {
        total: 0,
        byType: {},
        averageSentiment: 0,
        averageScore: 0,
        uniqueDrivers: 0,
        uniqueTrips: 0
      }
    });
  }
});

// Get analytics by type
app.get('/api/analytics/:type', async (req, res) => {
  try {
    if (!mongoDb) {
      return res.status(503).json({ 
        error: 'MongoDB not connected',
        feedback: [],
        statistics: {
          total: 0,
          averageSentiment: 0
        }
      });
    }
    
    const { type } = req.params;
    const normalizedType = type === 'mobile' ? 'app' : type;
    const collection = mongoDb.collection('feedback');
    
    const feedback = await collection
      .find({ type: normalizedType })
      .sort({ processed_at: -1 })
      .toArray();
    
    // Calculate type-specific statistics
    let totalSentiment = 0;
    let sentimentCount = 0;
    
    const stats = {
      total: feedback.length,
      averageSentiment: 0,
    };
    
    feedback.forEach((item) => {
      if (item.sentiment_score !== undefined && item.sentiment_score !== null) {
        totalSentiment += item.sentiment_score;
        sentimentCount++;
      }
    });
    
    stats.averageSentiment = sentimentCount > 0 ? totalSentiment / sentimentCount : 0;
    
    res.json({
      feedback,
      statistics: stats,
    });
  } catch (error) {
    console.error('Error fetching type analytics:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      feedback: [],
      statistics: {
        total: 0,
        averageSentiment: 0
      }
    });
  }
});

// Get driver performance over time
app.get('/api/analytics/drivers/:driverId/performance', async (req, res) => {
  try {
    if (!mongoDb) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }
    
    const { driverId } = req.params;
    const collection = mongoDb.collection('feedback');
    
    const feedback = await collection
      .find({ driverId })
      .sort({ processed_at: 1 })
      .toArray();
    
    // Group by date and calculate averages
    const performance = feedback.map((item) => ({
      date: item.processed_at ? new Date(item.processed_at).toISOString().split('T')[0] : null,
      sentimentScore: item.sentiment_score,
      driverScore: item.driver_ema_score,
      type: item.type,
    }));
    
    res.json({
      driverId,
      performance,
      totalFeedback: feedback.length,
    });
  } catch (error) {
    console.error('Error fetching driver performance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server with error handling
const server = app.listen(PORT, () => {
  console.log(`🚀 API Service running on port ${PORT}`);
  console.log(`📡 Redis: Upstash Redis REST API`);
  console.log(`📬 Queue: sentiment_feedback_queue`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error('❌ Port 3000 is already in use!');
    console.error('');
    console.error('💡 To fix this:');
    console.error('   1. Find the process using port 3000:');
    console.error('      netstat -ano | findstr :3000');
    console.error('   2. Kill the process (replace PID with actual process ID):');
    console.error('      taskkill /PID <PID> /F');
    console.error('   3. Or change the port in .env file: PORT=3001');
    console.error('');
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  if (mongoClient) await mongoClient.close();
  process.exit(0);
});

