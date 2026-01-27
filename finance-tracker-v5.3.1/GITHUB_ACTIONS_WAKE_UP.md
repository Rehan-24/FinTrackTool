# GitHub Actions - Render Wake Up Strategy

Your Finance Tracker now includes GitHub Actions to automatically wake up your Render site during business hours and let it sleep at night to save resources.

## What's Included

### 1. Morning Wake-Up (`wake-render.yml`)
**Purpose:** Wakes up the site at the start of each day

**Schedule:**
- **Weekdays:** 6 AM Pacific Time (2 PM UTC)
- **Weekends:** 8 AM Pacific Time (4 PM UTC)

**How it works:**
- Pings `/api/health` endpoint
- Retries once if first ping fails
- Logs success/failure

### 2. Business Hours Keep-Alive (`keep-awake.yml`)
**Purpose:** Keeps site awake during active hours

**Schedule:**
- **Weekdays:** Every 10 minutes from 6 AM - 10 PM Pacific
- **Weekends:** Every 10 minutes from 8 AM - 10 PM Pacific

**How it works:**
- Pings health endpoint every 10 minutes
- Prevents Render's 15-minute inactivity timeout
- Stops at 10 PM to allow site to sleep

## Setup Instructions

### Step 1: Update URLs
In both workflow files, replace:
```yaml
https://your-app.onrender.com/api/health
```

With your actual Render URL:
```yaml
https://financetracker.onrender.com/api/health
```

### Step 2: Commit and Push
```bash
git add .github/workflows/
git commit -m "Add GitHub Actions for Render wake-up"
git push
```

### Step 3: Verify in GitHub
1. Go to your GitHub repo
2. Click "Actions" tab
3. You should see:
   - "Wake Up Render (Morning)"
   - "Keep Render Awake (Business Hours)"

### Step 4: Test Manually
1. Go to Actions tab
2. Click on a workflow
3. Click "Run workflow" dropdown
4. Click "Run workflow" button
5. Watch it run!

## Customizing the Schedule

### Change Time Zone
Currently set to Pacific Time (UTC-8). To change:

**Example: Eastern Time (UTC-5)**
```yaml
# 6 AM ET = 11 AM UTC
- cron: '*/10 11-23 * * 1-5'
- cron: '*/10 0-3 * * 2-6'
```

**Example: Central Time (UTC-6)**
```yaml
# 6 AM CT = 12 PM UTC
- cron: '*/10 12-23 * * 1-5'
- cron: '*/10 0-4 * * 2-6'
```

### Change Active Hours

**Wake up earlier (5 AM PT):**
```yaml
- cron: '0 13 * * 1-5'  # 5 AM PT = 1 PM UTC
```

**Stay awake later (midnight PT):**
```yaml
- cron: '*/10 14-23 * * 1-5'  # 6 AM - 11:50 PM PT
- cron: '*/10 0-8 * * 2-6'    # 12:00 AM - 12 AM PT (extended)
```

**Ping less frequently (every 15 minutes):**
```yaml
- cron: '*/15 14-23 * * 1-5'
```

### Different Weekend Hours

**Weekends only 10 AM - 6 PM:**
```yaml
# 10 AM PT = 6 PM UTC, 6 PM PT = 2 AM UTC (next day)
- cron: '*/10 18-23 * * 0,6'
- cron: '*/10 0-2 * * 0,1'
```

## Cron Syntax Reference

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-6, Sunday=0)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23, in UTC)
└─────────── Minute (0-59)
```

**Examples:**
- `*/10 * * * *` - Every 10 minutes
- `0 14 * * 1-5` - 2 PM UTC, Monday-Friday
- `0 9,17 * * *` - 9 AM and 5 PM UTC, every day

## Cost Savings

### Without GitHub Actions:
- Site awake 24/7 = ~720 hours/month
- Render free tier = 750 hours/month
- ✅ Within limit but cutting it close

### With GitHub Actions (6 AM - 10 PM):
- Site awake ~16 hours/day × 30 days = ~480 hours/month
- Savings: ~240 hours/month
- ✅ Plenty of headroom in free tier

### With Night Sleep (10 PM - 6 AM):
- Site sleeps 8 hours/night
- Cold start on first morning access (~30 seconds)
- Subsequent accesses are instant

## Monitoring

### View Workflow Runs
1. GitHub repo → Actions tab
2. Click on a workflow
3. See history of all runs
4. Green checkmark = success
5. Red X = failed (check logs)

### View Logs
1. Click on a specific run
2. Click on the job name
3. Expand steps to see output
4. Look for "✅ Health check passed" or "⚠️" warnings

## Troubleshooting

### Workflow not running?
**Check:**
- Workflows are in `.github/workflows/` folder
- Files have `.yml` extension
- Committed and pushed to GitHub
- Actions are enabled in repo settings

### Wrong time zone?
**Fix:**
- Calculate your timezone offset from UTC
- Update cron schedules accordingly
- Remember UTC doesn't observe daylight saving

### Site still sleeping?
**Check:**
- Workflow is actually running (check Actions tab)
- URL in workflow matches your Render URL
- Health endpoint is responding (test manually)

### Ping failures?
**Common causes:**
- Render service is paused (check Render dashboard)
- URL typo in workflow file
- Network issues (rare, GitHub will retry)

## Alternative: Simple 24/7 Approach

If you prefer simplicity over cost savings:

**Option 1: Use cron-job.org**
- Free external service
- Set to ping every 10 minutes, 24/7
- No GitHub Actions needed
- See `KEEP_AWAKE_GUIDE.md`

**Option 2: Upgrade Render**
- Starter plan: $7/month
- Site never sleeps
- No configuration needed

## Best Practices

### For Personal Use:
✅ Use GitHub Actions with business hours
- Saves resources
- Site is fast when you need it
- Free tier lasts longer

### For Public Apps:
✅ Use external service (cron-job.org) or upgrade Render
- Ensures 24/7 availability
- No dependency on GitHub Actions uptime
- Better user experience

## Next Steps

1. **Update URLs** in workflow files
2. **Commit and push** to GitHub
3. **Test manually** via Actions tab
4. **Monitor first few runs** to confirm timing
5. **Adjust schedule** if needed

Your Render site will now wake up automatically every morning and stay awake during your active hours! 🌅

---

**Note:** GitHub Actions runs are subject to GitHub's fair use policy. The schedules above are well within normal usage limits.
