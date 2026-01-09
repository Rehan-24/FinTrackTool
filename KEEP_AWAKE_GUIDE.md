# Keeping Your Render App Awake

Render's free tier spins down your app after 15 minutes of inactivity. This guide shows you how to keep it awake using automated cron job services.

## Health Check Endpoint

Your app now has a health check endpoint at:
```
https://your-app.onrender.com/api/health
```

This endpoint returns:
```json
{
  "status": "ok",
  "timestamp": "2026-01-09T12:34:56.789Z",
  "message": "Finance Tracker is awake"
}
```

## Option 1: cron-job.org (Recommended - Free & Easy)

### Setup:
1. Go to https://cron-job.org/en/
2. Create a free account
3. Click "Create Cronjob"
4. Configure:
   - **Title**: Finance Tracker Keep Alive
   - **URL**: `https://your-app.onrender.com/api/health`
   - **Schedule**: Every 10 minutes
     - Pattern: `*/10 * * * *`
   - **Request Method**: GET
   - **Timeout**: 30 seconds

### Why 10 minutes?
Render spins down after 15 minutes, so pinging every 10 minutes ensures it never sleeps.

## Option 2: UptimeRobot (Free - Also monitors uptime)

### Setup:
1. Go to https://uptimerobot.com/
2. Create a free account
3. Click "+ Add New Monitor"
4. Configure:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: Finance Tracker
   - **URL**: `https://your-app.onrender.com/api/health`
   - **Monitoring Interval**: 5 minutes (free tier)

### Benefits:
- Keeps your app awake
- Alerts you if the app goes down
- Provides uptime statistics

## Option 3: EasyCron (Free tier available)

### Setup:
1. Go to https://www.easycron.com/
2. Create account
3. Add new cron job:
   - **URL**: `https://your-app.onrender.com/api/health`
   - **Expression**: `*/10 * * * *` (every 10 minutes)
   - **Method**: GET

## Option 4: GitHub Actions (Free for public repos)

Create `.github/workflows/keep-alive.yml`:

```yaml
name: Keep Render Awake

on:
  schedule:
    # Runs every 10 minutes
    - cron: '*/10 * * * *'
  workflow_dispatch: # Manual trigger

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping health endpoint
        run: |
          curl -f https://your-app.onrender.com/api/health || exit 0
```

## Option 5: Self-hosted script (If you have a server)

Create a bash script:

```bash
#!/bin/bash
# keep-alive.sh

curl -s https://your-app.onrender.com/api/health > /dev/null

if [ $? -eq 0 ]; then
  echo "$(date): Ping successful"
else
  echo "$(date): Ping failed"
fi
```

Add to crontab:
```bash
crontab -e

# Add this line (runs every 10 minutes)
*/10 * * * * /path/to/keep-alive.sh >> /var/log/finance-tracker-ping.log 2>&1
```

## Option 6: Zapier/Make.com (If you already use them)

### Zapier:
1. Create a new Zap
2. Trigger: Schedule by Zapier (every 10 minutes)
3. Action: Webhooks by Zapier - GET Request
4. URL: `https://your-app.onrender.com/api/health`

### Make.com:
1. Create a new scenario
2. Add HTTP module
3. Method: GET
4. URL: `https://your-app.onrender.com/api/health`
5. Schedule: Every 10 minutes

## Verification

To verify it's working:

1. **Check the health endpoint directly**:
   ```bash
   curl https://your-app.onrender.com/api/health
   ```

2. **Monitor Render logs**:
   - Go to your Render dashboard
   - Click on your service
   - View "Logs" tab
   - You should see GET requests to `/api/health` every 10 minutes

3. **Check your cron service logs**:
   - Most cron services show execution history
   - Verify requests are succeeding (200 status)

## Cost Comparison

| Service | Free Tier | Limitations |
|---------|-----------|-------------|
| cron-job.org | ✅ Yes | 50 cronjobs, 1 request/minute |
| UptimeRobot | ✅ Yes | 50 monitors, 5-min intervals |
| EasyCron | ✅ Yes | 1 cron job |
| GitHub Actions | ✅ Yes | 2000 min/month (plenty!) |
| Zapier | ⚠️ Limited | 100 tasks/month (720 needed) |
| Make.com | ⚠️ Limited | 1000 ops/month (4320 needed) |

## Recommended Setup

**Best option**: **cron-job.org** or **UptimeRobot**

Why?
- ✅ Completely free
- ✅ No account limits for this use case
- ✅ Simple setup (5 minutes)
- ✅ Reliable
- ✅ Web dashboard to monitor
- ✅ No code needed

## Important Notes

### Render Free Tier Limitations:
- 750 hours/month free compute time
- With keep-alive: uses ~720 hours/month
- Still within free tier!
- App loads faster (no cold starts)

### Alternative: Upgrade Render
If you don't want to manage a cron job:
- Render Starter Plan: $7/month
- App never sleeps
- Better performance
- No configuration needed

## Troubleshooting

### App still sleeping?
1. Check cron job is actually running (check logs)
2. Verify URL is correct
3. Ensure health endpoint returns 200 status
4. Try 5-minute interval instead of 10

### Getting rate limited?
- Use 10-minute intervals (not faster)
- Don't use multiple services simultaneously
- Check Render logs for errors

### Health endpoint not working?
```bash
# Test it manually
curl -v https://your-app.onrender.com/api/health

# Should return 200 with JSON response
```

## Quick Start (Fastest Method)

1. Go to https://cron-job.org/en/
2. Sign up (30 seconds)
3. Create cronjob:
   - URL: `https://your-app.onrender.com/api/health`
   - Every: `*/10 * * * *`
4. Save
5. Done! ✅

Your app will now stay awake 24/7!
