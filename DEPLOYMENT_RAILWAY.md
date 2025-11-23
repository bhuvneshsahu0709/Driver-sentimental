# Railway Deployment Guide

## Overview
Railway is the **recommended platform** for this project as it supports both Node.js and Python services natively.

## Prerequisites
- GitHub account (your code is already there)
- Railway account (sign up at https://railway.app)
- Upstash Redis credentials (already have)
- MongoDB Atlas credentials (already have)

## Step 1: Sign Up for Railway
1. Go to https://railway.app
2. Click "Start a New Project"
3. Sign up with GitHub (recommended for easy integration)

## Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository: `bhuvneshsahu0709/Driver-sentimental`

## Step 3: Deploy API Service (Node.js)

### 3.1 Add First Service
1. Railway will detect your repo
2. Click "Add Service" → "GitHub Repo"
3. Select your repo again
4. **IMPORTANT**: Go to Settings → Source → Set **Root Directory** to: `api-service`
5. Railway will auto-detect Node.js and use the `railway.json` in that directory
6. The start command will be: `npm start` (from railway.json)

### 3.2 Configure Environment Variables
Go to the service → Variables tab, add:
```
PORT=3000
UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token
MONGO_URI=your_mongodb_atlas_uri
```

### 3.3 Deploy
- Railway will automatically deploy
- Wait for build to complete
- Your API will be available at: `https://your-app-name.up.railway.app`

## Step 4: Deploy Worker Service (Python)

### 4.1 Add Second Service
1. In the same project, click "Add Service" → "GitHub Repo"
2. Select the same repo
3. **IMPORTANT**: Go to Settings → Source → Set **Root Directory** to: `sentiment-worker`
4. Railway will auto-detect Python and use the `railway.json` in that directory
5. The start command will be: `python worker.py` (from railway.json)

### 4.2 Configure Environment Variables
Go to the worker service → Variables tab, add:
```
UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token
MONGO_URI=your_mongodb_atlas_uri
MONGO_DB=movesync
SENTIMENT_THRESHOLD=2.5
ALERT_COOLDOWN_SECONDS=1800
EMA_ALPHA=0.2
```

### 4.3 Deploy
- Railway will automatically deploy
- Worker will start processing the queue

## Step 5: Configure Custom Domain (Optional)
1. Go to your API service → Settings → Domains
2. Add your custom domain
3. Railway will provide DNS instructions

## Step 6: Monitor Services
- View logs: Click on service → Logs tab
- Check metrics: Service → Metrics tab
- View deployments: Service → Deployments tab

## Troubleshooting

### API Service Not Starting
- Check logs for errors
- Verify all environment variables are set
- Ensure PORT is set (Railway auto-assigns, but 3000 works)

### Worker Not Processing
- Check worker logs
- Verify Redis and MongoDB connections
- Ensure all environment variables match API service

### Build Failures
- Check build logs
- Verify package.json and requirements.txt are correct
- Ensure root directories are set correctly

## Railway Pricing
- **Free Tier**: $5 credit/month (enough for development)
- **Hobby Plan**: $5/month per service (recommended for production)
- **Pro Plan**: $20/month (for scaling)

## Tips
- Use Railway's shared environment variables for common values
- Enable auto-deploy from main branch
- Set up health checks for monitoring
- Use Railway's metrics to monitor resource usage

