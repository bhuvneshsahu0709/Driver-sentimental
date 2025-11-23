# Driver Sentiment Engine
Event-driven backend system for analyzing driver feedback sentiment, calculating real-time scores, and triggering alerts.

# App Landing Page
<img width="1891" height="968" alt="Screenshot 2025-11-24 000538" src="https://github.com/user-attachments/assets/519c32e5-1f3c-4e9e-8cdb-2fa69d90393b" />

# Dashboard Overview
<img width="1895" height="962" alt="Screenshot 2025-11-24 000601" src="https://github.com/user-attachments/assets/125b36f4-87da-43f6-94ed-562cad710586" />

# Sentimental Trends
<img width="1891" height="950" alt="Screenshot 2025-11-24 000843" src="https://github.com/user-attachments/assets/009d86b2-c066-4dd0-8cec-6cefddb81915" />

# Driver Alert System
<img width="1884" height="966" alt="Screenshot 2025-11-24 001721" src="https://github.com/user-attachments/assets/759ca878-6d56-4cf1-8438-c9c8eb9b3f20" />

# Feedback Form
<img width="1893" height="963" alt="Screenshot 2025-11-24 000919" src="https://github.com/user-attachments/assets/56a91be3-3bce-412e-a28f-d242aa9edb0d" />

# 🔐 Admin Login Credentials

To access the Admin Dashboard, use the following credentials:
Username: admin
Password: 12345

## Architecture

- **API Service (Node.js)**: Express server that accepts feedback and queues it for processing
- **Sentiment Worker (Python)**: Continuously processes queued feedback, performs sentiment analysis, and updates driver scores
- **Redis**: Queue management (BullMQ) and caching of driver scores
- **MongoDB**: Persistent storage for raw feedback logs

## Project Structure

```
MoveInSync/
├── api-service/
│   ├── server.js          # Express API with BullMQ queue producer
│   ├── package.json
│   └── env.example
├── sentiment-worker/
│   ├── worker.py          # Python worker with VADER sentiment analysis
│   ├── requirements.txt
│   └── env.example
└── README.md
```

## Quick Start

### 1. Setup Environment Variables

**For API Service (`api-service/.env`):**
```env
PORT=3000
REDIS_URL=redis://default:your-password@your-endpoint.upstash.io:6379
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/movesync
```

**For Worker (`sentiment-worker/.env`):**
```env
REDIS_URL=redis://default:your-password@your-endpoint.upstash.io:6379
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/movesync
MONGO_DB=movesync
SENTIMENT_THRESHOLD=2.5
ALERT_COOLDOWN_SECONDS=1800
EMA_ALPHA=0.2
```

**Note:** 
- Get Upstash Redis URL from: https://console.upstash.com/
- Get MongoDB Atlas URI from: https://cloud.mongodb.com/

### 2. Setup API Service

```bash
cd api-service
npm install
# Copy env.example to .env and update with your credentials
npm start
```

API will run on `http://localhost:3000`

### 3. Setup Sentiment Worker

```bash
cd sentiment-worker
pip install -r requirements.txt
# Copy env.example to .env and update with your credentials
python worker.py
```

## API Endpoints

### POST /feedback

Submit feedback for sentiment processing.

**Request:**
```json
{
  "driverId": "driver_123",
  "tripId": "trip_456",
  "comment": "Great driver, very professional!",
  "type": "driver"
}
```

**Response:** `202 Accepted`
```json
{
  "message": "Feedback received and queued for processing",
  "driverId": "driver_123",
  "type": "driver"
}
```

### GET /health

Health check endpoint.

## Sentiment Analysis

- Uses **VADER** (Valence Aware Dictionary and sEntiment Reasoner) from NLTK
- Normalizes scores to 0-5 scale (where 2.5 is neutral)
- Implements **Exponential Moving Average (EMA)** with α = 0.2

### EMA Formula

```
NewScore = (Alpha × CurrentSentiment) + ((1 - Alpha) × PreviousScore)
```

- Recent feedback has 20% weight
- Historical average has 80% weight
- Smoothly adapts to trends without overreacting

## Alerting

- Triggers when driver score < 2.5
- Cooldown period: 30 minutes (prevents spam)
- Stored in Redis: `alert_cooldown:{driverId}`

## Data Storage

### Redis Keys

- `driver_score:{driverId}` - Current EMA score (0-5)
- `alert_cooldown:{driverId}` - Alert cooldown flag (TTL: 30 min)
- `sentiment_queue:process-sentiment` - BullMQ job queue

### MongoDB Collections

- `feedback` - Raw feedback documents with sentiment scores

## Configuration

### API Service (.env)

```
PORT=3000
REDIS_URL=redis://default:password@endpoint.upstash.io:6379
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/movesync
```

### Worker (.env)

```
REDIS_URL=redis://default:password@endpoint.upstash.io:6379
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/movesync
MONGO_DB=movesync
SENTIMENT_THRESHOLD=2.5
ALERT_COOLDOWN_SECONDS=1800
EMA_ALPHA=0.2
```

## Testing

### Submit Test Feedback

```bash
curl -X POST http://localhost:3000/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "driver_001",
    "tripId": "trip_001",
    "comment": "Excellent service, very safe driver!",
    "type": "driver"
  }'
```

### Check Driver Score

Use the API endpoint:
```bash
curl http://localhost:3000/api/drivers/driver_001/score
```

Or use Upstash Redis Console: https://console.upstash.com/

### View Feedback in MongoDB

Use MongoDB Atlas Compass or the API endpoint:
```bash
curl http://localhost:3000/api/analytics/feedback
```

## Design Decisions

1. **Event-Driven**: Decouples ingestion from processing, handles high volume
2. **BullMQ**: Reliable job queue with retry mechanisms
3. **EMA**: Balances recent vs historical feedback without full recomputation
4. **Cooldown**: Prevents alert spam for rapid negative feedback
5. **Dual Storage**: Redis for fast score access, MongoDB for audit trail

## Next Steps

- Add authentication/authorization
- Implement batch aggregation jobs
- Add metrics and monitoring
- Build admin dashboard
- Scale workers horizontally



