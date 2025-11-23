"""
Driver Sentiment Engine - Worker Service
Continuously processes feedback from Redis queue, performs sentiment analysis,
calculates EMA-based driver scores, and triggers alerts when thresholds are breached.
"""

import os
import time
import logging
import json
from datetime import datetime
from typing import Dict, Optional
from dotenv import load_dotenv
from upstash_redis import Redis
from pymongo import MongoClient
from nltk.sentiment import SentimentIntensityAnalyzer
from nltk.downloader import download
import nltk

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
# Upstash Redis REST API credentials
UPSTASH_REDIS_REST_URL = os.getenv('UPSTASH_REDIS_REST_URL')
UPSTASH_REDIS_REST_TOKEN = os.getenv('UPSTASH_REDIS_REST_TOKEN')
# MongoDB Connection String - Using MongoDB Atlas
MONGO_URI = os.getenv('MONGO_URI', 'mongodb+srv://bhuvnesh:bhuvnesh@cluster0.nm7zbfj.mongodb.net/movesync?retryWrites=true&w=majority')
MONGO_DB = os.getenv('MONGO_DB', 'movesync')
SENTIMENT_THRESHOLD = float(os.getenv('SENTIMENT_THRESHOLD', '2.5'))
ALERT_COOLDOWN_SECONDS = int(os.getenv('ALERT_COOLDOWN_SECONDS', 1800))  # 30 minutes
EMA_ALPHA = float(os.getenv('EMA_ALPHA', '0.2'))  # Exponential Moving Average smoothing factor

# Initialize NLTK VADER Sentiment Analyzer
try:
    nltk.data.find('vader_lexicon')
except LookupError:
    logger.info("Downloading VADER lexicon...")
    download('vader_lexicon', quiet=True)

sia = SentimentIntensityAnalyzer()

# Initialize Upstash Redis REST API client
if not UPSTASH_REDIS_REST_URL or not UPSTASH_REDIS_REST_TOKEN:
    raise ValueError(
        'Upstash Redis credentials are not set in the environment variables. '
        'Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your .env file. '
        'Get these from: https://console.upstash.com/ → Your Database → REST API'
    )

redis_client = Redis(
    url=UPSTASH_REDIS_REST_URL,
    token=UPSTASH_REDIS_REST_TOKEN,
)

# Initialize MongoDB connection
mongo_client = None
mongo_db = None
feedback_collection = None

try:
    logger.info(f"🔄 Attempting to connect to MongoDB Atlas...")
    logger.info(f"Database: {MONGO_DB}")
    
    connect_options = {
        'serverSelectionTimeoutMS': 15000,  # 15 seconds timeout
        'connectTimeoutMS': 15000,
        'socketTimeoutMS': 20000,
    }
    
    # Mask password in logs
    masked_uri = MONGO_URI
    if '@' in masked_uri:
        parts = masked_uri.split('@')
        if '://' in parts[0]:
            protocol_user = parts[0].split('://')
            if ':' in protocol_user[1]:
                user_pass = protocol_user[1].split(':')
                masked_uri = f"{protocol_user[0]}://{user_pass[0]}:***@{parts[1]}"
    
    logger.info(f"MongoDB URI: {masked_uri}")
    
    mongo_client = MongoClient(MONGO_URI, **connect_options)
    mongo_db = mongo_client[MONGO_DB]
    feedback_collection = mongo_db['feedback']
    
    # Test connection by checking server info
    logger.info("Testing connection with ping...")
    mongo_client.admin.command('ping')
    logger.info(f"✅ Connected to MongoDB Atlas - Database: {MONGO_DB}, Collection: feedback")
    
    # Check existing document count
    try:
        count = feedback_collection.count_documents({})
        logger.info(f"📊 Existing feedback documents in MongoDB: {count}")
        if count > 0:
            # Show sample document
            sample = feedback_collection.find_one()
            if sample:
                logger.info(f"📄 Sample document type: {sample.get('type', 'unknown')}")
    except Exception as count_error:
        logger.warning(f"Could not count documents: {count_error}")
        
except Exception as e:
    error_type = type(e).__name__
    error_message = str(e)
    
    logger.error("=" * 60)
    logger.error(f"❌ MongoDB Atlas Connection Failed!")
    logger.error("=" * 60)
    logger.error(f"Error Type: {error_type}")
    logger.error(f"Error Message: {error_message}")
    logger.error(f"MongoDB URI: {masked_uri}")
    logger.error("")
    logger.error("🔍 Common MongoDB Atlas Connection Issues:")
    logger.error("")
    logger.error("1. IP ADDRESS NOT WHITELISTED (Most Common)")
    logger.error("   → Go to MongoDB Atlas Dashboard")
    logger.error("   → Network Access → Add IP Address")
    logger.error("   → Click 'Add Current IP Address' or 'Allow Access from Anywhere' (0.0.0.0/0)")
    logger.error("   → Wait 1-2 minutes for changes to propagate")
    logger.error("")
    logger.error("2. INCORRECT USERNAME OR PASSWORD")
    logger.error("   → Check Database Access in Atlas")
    logger.error("   → Verify username: bhuvnesh")
    logger.error("   → Reset password if needed")
    logger.error("   → URL encode special characters in password (@ = %40, # = %23, etc.)")
    logger.error("")
    logger.error("3. DATABASE USER PERMISSIONS")
    logger.error("   → Go to Database Access")
    logger.error("   → Ensure user has 'Read and write to any database' or 'Atlas admin' role")
    logger.error("")
    logger.error("4. NETWORK/FIREWALL ISSUES")
    logger.error("   → Check if your network blocks port 27017")
    logger.error("   → Try from a different network")
    logger.error("   → Check corporate firewall settings")
    logger.error("")
    logger.error("5. CONNECTION STRING FORMAT")
    logger.error("   → Ensure connection string includes database name: /movesync")
    logger.error("   → Format: mongodb+srv://user:pass@cluster.mongodb.net/dbname?options")
    logger.error("")
    logger.error("💡 Quick Test:")
    logger.error("   Try connecting from MongoDB Compass or mongosh:")
    logger.error(f"   {masked_uri}")
    logger.error("=" * 60)
    
    # Don't raise - allow worker to continue (it will retry on next feedback)
    logger.warning("⚠️  Worker will continue but feedback won't be stored until MongoDB connects")
    logger.warning("⚠️  Restart worker after fixing MongoDB connection")

# Test Redis connection
try:
    redis_client.ping()
    logger.info("✅ Connected to Redis")
except Exception as e:
    logger.error(f"❌ Failed to connect to Redis: {e}")
    raise


def get_sentiment_score(comment: str) -> float:
    """
    Analyzes text sentiment using VADER and returns a normalized score (0-5 scale).
    
    VADER returns a compound score in range [-1, 1]:
    - -1 to -0.05: Negative
    - -0.05 to 0.05: Neutral
    - 0.05 to 1: Positive
    
    We normalize to 0-5 scale for consistency with threshold (2.5).
    
    Args:
        comment: Text feedback to analyze
        
    Returns:
        float: Sentiment score on 0-5 scale
    """
    scores = sia.polarity_scores(comment)
    compound = scores['compound']  # Range: -1 to 1
    
    # Normalize to 0-5 scale
    # Formula: (compound + 1) / 2 * 5
    # -1 -> 0, 0 -> 2.5, 1 -> 5
    normalized_score = ((compound + 1) / 2) * 5
    
    logger.debug(f"Sentiment analysis - Compound: {compound:.3f}, Normalized: {normalized_score:.3f}")
    return normalized_score


def get_driver_score(driver_id: str) -> Optional[float]:
    """
    Retrieves the current EMA score for a driver from Redis.
    
    Args:
        driver_id: Unique driver identifier
        
    Returns:
        Current score (0-5) or None if driver has no previous score
    """
    score_key = f"driver_score:{driver_id}"
    score_str = redis_client.get(score_key)
    
    if score_str is None:
        return None
    
    try:
        return float(score_str)
    except (ValueError, TypeError):
        logger.warning(f"Invalid score format for driver {driver_id}: {score_str}")
        return None


def update_driver_score(driver_id: str, new_sentiment: float) -> float:
    """
    Updates driver score using Exponential Moving Average (EMA).
    
    EMA Formula: NewScore = (Alpha * CurrentSentiment) + ((1 - Alpha) * PreviousScore)
    
    Where:
    - Alpha (α) = 0.2 (weight for new sentiment, higher = more reactive)
    - CurrentSentiment = newly calculated sentiment from feedback
    - PreviousScore = existing EMA score (or new sentiment if first time)
    
    Properties:
    - If no previous score exists, uses new sentiment as initial score
    - Recent feedback has more weight (20%) than historical average (80%)
    - Smoothly adapts to trends without overreacting to single feedback
    
    Args:
        driver_id: Unique driver identifier
        new_sentiment: Current sentiment score (0-5) from this feedback
        
    Returns:
        Updated EMA score (0-5)
    """
    previous_score = get_driver_score(driver_id)
    
    if previous_score is None:
        # First feedback for this driver - initialize with current sentiment
        new_score = new_sentiment
        logger.info(f"Initializing score for driver {driver_id}: {new_score:.3f}")
    else:
        # Apply EMA formula
        # NewScore = (Alpha * CurrentSentiment) + ((1 - Alpha) * PreviousScore)
        new_score = (EMA_ALPHA * new_sentiment) + ((1 - EMA_ALPHA) * previous_score)
        logger.info(
            f"EMA update for driver {driver_id}: "
            f"Previous={previous_score:.3f}, NewSentiment={new_sentiment:.3f}, "
            f"Updated={new_score:.3f} (Alpha={EMA_ALPHA})"
        )
    
    # Store updated score in Redis (no expiration - persistent)
    score_key = f"driver_score:{driver_id}"
    redis_client.set(score_key, str(new_score))
    
    return new_score


def check_and_trigger_alert(driver_id: str, current_score: float) -> bool:
    """
    Checks if alert should be triggered and implements cooldown mechanism.
    
    Alert conditions:
    1. Score < threshold (default 2.5)
    2. Cooldown period has expired (30 minutes)
    
    Args:
        driver_id: Unique driver identifier
        current_score: Current EMA score (0-5)
        
    Returns:
        True if alert was triggered, False otherwise
    """
    if current_score >= SENTIMENT_THRESHOLD:
        return False
    
    # Check cooldown
    cooldown_key = f"alert_cooldown:{driver_id}"
    cooldown_exists = redis_client.exists(cooldown_key)
    
    if cooldown_exists:
        logger.info(
            f"Alert cooldown active for driver {driver_id} "
            f"(score: {current_score:.3f} < {SENTIMENT_THRESHOLD})"
        )
        return False
    
    # Trigger alert
    logger.warning(
        f"🚨 ALERT TRIGGERED for Driver {driver_id} - "
        f"Score: {current_score:.3f} (Threshold: {SENTIMENT_THRESHOLD})"
    )
    
    # Set cooldown to prevent spam (30 minutes TTL)
    redis_client.setex(cooldown_key, ALERT_COOLDOWN_SECONDS, "1")
    logger.info(f"Alert cooldown set for driver {driver_id} ({ALERT_COOLDOWN_SECONDS}s)")
    
    return True


def store_feedback_in_mongodb(feedback_data: Dict) -> None:
    """
    Stores raw feedback document in MongoDB for audit and analytics.
    
    Args:
        feedback_data: Complete feedback payload including metadata
    """
    if feedback_collection is None:
        logger.error("❌ Cannot store feedback - MongoDB not connected")
        logger.error("   Please fix MongoDB connection and restart worker")
        return
    
    try:
        document = {
            **feedback_data,
            'processed_at': datetime.utcnow(),
        }
        result = feedback_collection.insert_one(document)
        logger.info(f"✅ Stored feedback in MongoDB - ID: {result.inserted_id}, Type: {feedback_data.get('type')}, DriverId: {feedback_data.get('driverId')}")
    except Exception as e:
        logger.error(f"❌ Failed to store feedback in MongoDB: {e}", exc_info=True)
        # Don't re-raise - allow processing to continue even if storage fails


def process_feedback(job_data: Dict) -> None:
    """
    Main processing function for a single feedback entry.
    
    Workflow:
    1. Extract sentiment from comment using VADER
    2. Update driver's EMA score in Redis (if driverId exists)
    3. Check threshold and trigger alert if needed
    4. Store raw feedback in MongoDB
    
    Args:
        job_data: Feedback payload from queue
    """
    driver_id = job_data.get('driverId')
    comment = job_data.get('comment', '')
    feedback_type = job_data.get('type', 'driver')
    
    logger.info(f"🔄 Processing feedback (type: {feedback_type}, driverId: {driver_id})")
    logger.debug(f"Feedback payload: {json.dumps(job_data, default=str)}")
    
    # Step 1: Analyze sentiment
    sentiment_score = get_sentiment_score(comment)
    logger.info(f"📊 Sentiment score: {sentiment_score:.3f}")
    
    # Step 2: Update driver score using EMA (only if driverId exists)
    updated_score = None
    if driver_id:
        updated_score = update_driver_score(driver_id, sentiment_score)
        # Step 3: Check alert threshold (only for driver feedback)
        check_and_trigger_alert(driver_id, updated_score)
    else:
        logger.info(f"⚠️  No driverId for type {feedback_type}, skipping driver score update")
    
    # Step 4: Store in MongoDB
    document_data = {
        **job_data,
        'sentiment_score': sentiment_score,
    }
    
    # Only add driver_ema_score if we have one
    if updated_score is not None:
        document_data['driver_ema_score'] = updated_score
    
    logger.info(f"💾 Attempting to store in MongoDB...")
    logger.debug(f"Document data keys: {list(document_data.keys())}")
    try:
        store_feedback_in_mongodb(document_data)
        logger.info(f"✅ Successfully stored feedback in MongoDB")
        
        # Verify storage by checking count
        if feedback_collection is not None:
            try:
                count = feedback_collection.count_documents({})
                logger.info(f"📊 Total documents in MongoDB after storage: {count}")
            except Exception as verify_error:
                logger.warning(f"Could not verify storage: {verify_error}")
    except Exception as e:
        logger.error(f"❌ Failed to store in MongoDB: {e}", exc_info=True)
        # Mask password in URI for logging
        masked_uri = MONGO_URI
        if '@' in masked_uri:
            masked_uri = masked_uri.split('@')[0].split('://')[0] + '://***:***@' + '@'.join(masked_uri.split('@')[1:])
        logger.error(f"MongoDB URI: {masked_uri}")
        logger.error("Check MongoDB connection and permissions")
    
    logger.info(f"✅ Completed processing feedback (type: {feedback_type})")


def poll_queue():
    """
    Continuously polls Redis queue for new feedback jobs.
    Uses a simple Redis list: 'sentiment_feedback_queue'
    This is more reliable than parsing BullMQ's complex structure.
    """
    queue_name = 'sentiment_feedback_queue'
    
    logger.info(f"🔄 Worker started, polling queue: {queue_name}")
    logger.info(f"Configuration - Threshold: {SENTIMENT_THRESHOLD}, EMA Alpha: {EMA_ALPHA}")
    
    # Check queue length on startup
    try:
        queue_length = redis_client.llen(queue_name)
        logger.info(f"📊 Current queue length: {queue_length}")
        if queue_length > 0:
            logger.info(f"⚠️  Found {queue_length} pending jobs in queue")
    except Exception as e:
        logger.warning(f"Could not check queue length: {e}")
    
    while True:
        try:
            # Blocking pop from queue (waits up to 5 seconds)
            # This will wait for new jobs and return immediately when one arrives
            result = redis_client.blpop([queue_name], timeout=5)
            
            if result is None:
                # Timeout - no jobs available, continue polling
                continue
            
            list_key, job_data_str = result
            logger.info(f"📥 Received feedback from queue (data length: {len(job_data_str)} chars)")
            logger.debug(f"Raw job data preview: {job_data_str[:200]}...")
            
            try:
                # Parse job data (stored as JSON string)
                feedback_data = json.loads(job_data_str)
                logger.info(f"✅ Parsed job data - Type: {feedback_data.get('type')}, DriverId: {feedback_data.get('driverId')}, Comment length: {len(feedback_data.get('comment', ''))}")
                
                # Process the feedback
                process_feedback(feedback_data)
                
                logger.info(f"✅ Feedback processed and stored successfully")
                
            except json.JSONDecodeError as e:
                logger.error(f"❌ Failed to parse job data: {e}")
                logger.error(f"Raw data (first 200 chars): {job_data_str[:200]}")
                continue
            except Exception as e:
                logger.error(f"❌ Error processing feedback: {e}", exc_info=True)
                # In production, you might want to add failed jobs to a dead letter queue
                continue
                
        except KeyboardInterrupt:
            logger.info("Worker shutdown requested")
            break
        except Exception as e:
            logger.error(f"❌ Error processing queue: {e}", exc_info=True)
            time.sleep(1)  # Brief pause before retrying


if __name__ == '__main__':
    logger.info("🚀 Starting Driver Sentiment Engine Worker")
    poll_queue()

