# Railway Quick Setup Guide

## Step-by-Step Visual Guide

### For API Service:

1. **In Railway Dashboard:**
   - Click on your service
   - Go to **Settings** tab
   - Scroll to **Source** section

2. **Set Root Directory:**
   - Click **"Add Root Directory"** button
   - Enter: `api-service`
   - Click **Update** at bottom of page

3. **Set Start Command (if needed):**
   - Scroll to **Deploy** section
   - Find **"Custom Start Command"**
   - Enter: `npm start`
   - Click **Update**

4. **Set Environment Variables:**
   - Go to **Variables** tab
   - Add these variables:
     ```
     PORT=3000
     UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url
     UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token
     MONGO_URI=your_mongodb_atlas_uri
     ```

5. **Deploy:**
   - Railway will automatically redeploy after you update settings
   - Check **Deployments** tab to see build progress

### For Worker Service:

1. **Add New Service:**
   - In your Railway project, click **"New"** → **"GitHub Repo"**
   - Select your repo: `bhuvneshsahu0709/Driver-sentimental`

2. **Set Root Directory:**
   - Go to **Settings** → **Source**
   - Click **"Add Root Directory"**
   - Enter: `sentiment-worker`
   - Click **Update**

3. **Set Start Command:**
   - Go to **Settings** → **Deploy**
   - Find **"Custom Start Command"**
   - Enter: `python worker.py`
   - Click **Update**

4. **Set Environment Variables:**
   - Go to **Variables** tab
   - Add these variables:
     ```
     UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url
     UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token
     MONGO_URI=your_mongodb_atlas_uri
     MONGO_DB=movesync
     SENTIMENT_THRESHOLD=2.5
     ALERT_COOLDOWN_SECONDS=1800
     EMA_ALPHA=0.2
     ```

5. **Deploy:**
   - Railway will automatically deploy

## Important Notes:

- **Root Directory is CRITICAL** - Without it, Railway tries to build from root and fails
- After setting Root Directory, Railway will auto-detect Node.js/Python
- The `railway.json` files in each directory will be used automatically
- Environment variables must be set for both services

## Troubleshooting:

**If build still fails:**
- Make sure Root Directory is exactly `api-service` or `sentiment-worker` (no trailing slash)
- Check that `package.json` exists in `api-service/`
- Check that `requirements.txt` exists in `sentiment-worker/`
- Verify environment variables are set correctly

