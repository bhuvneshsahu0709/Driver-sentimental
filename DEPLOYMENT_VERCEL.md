# Vercel Deployment Guide

## ⚠️ Important Note
**Vercel is NOT recommended for this project** because:
- Vercel is designed for serverless functions, not long-running Express servers
- Your Python worker cannot run on Vercel (no background workers)
- Would require significant code refactoring

However, if you want to use Vercel for the API, you'll need to:
1. Convert Express routes to Vercel serverless functions
2. Deploy worker separately on Railway/Render

## Option 1: Hybrid Deployment (Recommended if using Vercel)
- **Vercel**: API Service (converted to serverless)
- **Railway/Render**: Python Worker

## Step 1: Convert Express API to Vercel Functions

### 1.1 Install Vercel CLI
```bash
npm install -g vercel
```

### 1.2 Create Vercel Configuration
Create `vercel.json` in `api-service/`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ],
  "env": {
    "UPSTASH_REDIS_REST_URL": "@upstash_redis_rest_url",
    "UPSTASH_REDIS_REST_TOKEN": "@upstash_redis_rest_token",
    "MONGO_URI": "@mongo_uri"
  }
}
```

### 1.3 Modify server.js for Vercel
Vercel expects a serverless function. You'll need to export handlers instead of using `app.listen()`:

```javascript
// At the end of server.js, replace app.listen() with:
module.exports = app; // For Vercel serverless
```

### 1.4 Deploy to Vercel
```bash
cd api-service
vercel login
vercel
```

Follow prompts:
- Link to existing project or create new
- Set environment variables
- Deploy

## Step 2: Deploy Worker on Railway (Required)
Since Vercel can't run the Python worker, deploy it separately:

1. Follow Railway deployment guide (Step 4)
2. Deploy only the worker service
3. It will connect to the same Redis and MongoDB

## Step 3: Update API URLs
After deployment:
- Update frontend to use Vercel API URL
- Ensure CORS is configured for your domain
- Test all endpoints

## Alternative: Full Railway Deployment (Easier)
Instead of this complex setup, use Railway for both services - it's much simpler and designed for this use case.

## Vercel Limitations for This Project
- ❌ No long-running processes
- ❌ No background workers
- ❌ 10-second function timeout (free tier)
- ❌ 50-second function timeout (pro tier)
- ❌ Requires code refactoring
- ✅ Good for static sites and simple APIs

## Recommendation
**Use Railway for both services** - it's designed for full-stack applications with background workers.

