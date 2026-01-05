# 🚀 Complete Setup Guide - Render + Supabase

This guide will walk you through deploying your Finance Tracker app from scratch using **Render** (hosting) and **Supabase** (database).

---

## 📋 Prerequisites

- GitHub account (free)
- Supabase account (free)
- Render account (free)
- Your finance-tracker code

---

## Part 1: Set Up Supabase Database (10 minutes)

### Step 1: Create Supabase Account

1. Go to **https://supabase.com**
2. Click **"Start your project"**
3. Sign up with GitHub (recommended) or email
4. Verify your email if needed

### Step 2: Create New Project

1. Click **"New project"**
2. Choose an organization (or create one)
3. Fill in project details:
   - **Name**: `finance-tracker` (or any name)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to you (US East, EU, etc.)
   - **Plan**: Free (plenty for this app)
4. Click **"Create new project"**
5. Wait ~2 minutes for setup to complete

### Step 3: Run Database Schema

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Open the file `supabase-schema.sql` from your finance-tracker folder
4. **Copy the ENTIRE contents** of the file (all ~300 lines)
5. **Paste** into the Supabase SQL editor
6. Click **"Run"** (or press Cmd/Ctrl + Enter)
7. You should see: `Success. No rows returned`

✅ **Your database is now set up with:**
- All 8 tables (users, categories, purchases, assets, goals, income, recurring_expenses, asset_history)
- Row-level security policies
- Indexes for performance
- Auto-create user profile trigger

### Step 4: Get Your API Keys

1. Go to **Settings** → **API** (left sidebar)
2. Find and copy these two values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public key** (long string starting with `eyJ...`)
3. **Save these somewhere** - you'll need them in Step 2!

---

## Part 2: Deploy to Render (15 minutes)

### Step 1: Push Code to GitHub

If you haven't already pushed your code to GitHub:

```bash
# Navigate to your project folder
cd path/to/finance-tracker

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Finance Tracker"

# Create a new repo on GitHub (github.com/new)
# Then connect and push:
git remote add origin https://github.com/YOUR_USERNAME/finance-tracker.git
git branch -M main
git push -u origin main
```

### Step 2: Create Render Account

1. Go to **https://render.com**
2. Click **"Get Started"**
3. Sign up with GitHub (recommended)
4. Authorize Render to access your GitHub repos

### Step 3: Create New Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository:
   - Find `finance-tracker` in the list
   - Click **"Connect"**
3. Configure the service:

**Basic Settings:**
- **Name**: `finance-tracker` (or any name - this will be in your URL)
- **Region**: Choose closest to you
- **Branch**: `main`
- **Root Directory**: (leave blank)
- **Runtime**: `Node`
- **Build Command**: 
  ```
  npm install && npm run build
  ```
- **Start Command**: 
  ```
  npm start
  ```

**Pricing:**
- **Instance Type**: `Free` (plenty for personal use)

### Step 4: Add Environment Variables

Scroll down to **Environment Variables** section:

1. Click **"Add Environment Variable"**
2. Add your first variable:
   - **Key**: `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: (paste your Supabase Project URL from Part 1, Step 4)
3. Click **"Add Environment Variable"** again
4. Add your second variable:
   - **Key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value**: (paste your Supabase anon key from Part 1, Step 4)

### Step 5: Deploy!

1. Click **"Create Web Service"** (bottom of page)
2. Render will now:
   - Clone your code
   - Install dependencies
   - Build your app
   - Deploy it live
3. Wait ~3-5 minutes for first deploy
4. Watch the logs for progress

✅ **When you see "Your service is live"**, you're done!

### Step 6: Access Your App

1. Your app URL will be: `https://finance-tracker-XXXX.onrender.com`
   - (Where XXXX is a random string Render assigns)
2. Click the URL to open your app
3. Sign up with your email/password
4. Start tracking your finances!

---

## Part 3: First Time Using the App (5 minutes)

### Step 1: Sign Up

1. Open your app URL
2. Click **"Don't have an account? Sign up"**
3. Enter:
   - Your name
   - Email address
   - Password (min 6 characters)
4. Click **"Sign Up"**
5. Check your email for verification link
6. Click the verification link
7. Go back to your app and **sign in**

### Step 2: Create Categories

1. Go to **Settings** (bottom nav on mobile, sidebar on desktop)
2. Click **"Add Category"**
3. Add your first categories, for example:
   - **Groceries** - Budget: $600 - Color: Green
   - **Dining Out** - Budget: $300 - Color: Orange
   - **Transportation** - Budget: $200 - Color: Blue
   - **Entertainment** - Budget: $150 - Color: Purple
4. These are just examples - create categories that fit YOUR life!

### Step 3: Add Your First Purchase

1. Click **"Add Purchase"** (+ button)
2. Fill in the form:
   - Amount: $45.50
   - Category: Groceries
   - Description: Whole Foods
   - Date: Today
3. Click **"Add Purchase"**
4. Check your dashboard - you'll see it counted!

### Step 4: Set Up Recurring Expenses

1. Go to **Recurring** page
2. Click **"Add Recurring"**
3. Add bills like:
   - Netflix - $15.99/month
   - Rent - $1,500/month on the 1st
   - Gym - $50/month
4. These will help you track fixed costs

### Step 5: Add Income

1. Go to **Income** page
2. Click **"Add Income"**
3. Add your income sources:
   - Salary - $5,000 - Monthly
   - Freelance - $500 - One-time (if applicable)
4. Your dashboard will now show income vs spending!

### Step 6: Track Assets (Optional)

1. Go to **Assets** page
2. Click **"New Asset"**
3. Add accounts like:
   - HYSA - Current value: $7,500
   - Checking - Current value: $2,000
4. Update these monthly

### Step 7: Set Goals (Optional)

1. Go to **Goals** page
2. Click **"New Goal"**
3. Create goals like:
   - **Emergency Fund**: Target $10,000 by Dec 2026
   - Link it to your HYSA asset
4. App will calculate: "Save $208/month to reach goal"

---

## 🎉 You're All Set!

Your finance tracker is now:
- ✅ Live on the internet 24/7
- ✅ Accessible from any device
- ✅ Backed by a secure database
- ✅ Free to use (within Render/Supabase limits)

**Your app URL**: `https://your-app-name.onrender.com`

Share this URL with your girlfriend so she can sign up too!

---

## 📱 Using the App

### On Mobile
- App automatically adapts to mobile screens
- Bottom navigation bar for easy access
- Large touch targets

### On Desktop
- Sidebar navigation
- Larger data tables
- Better for detailed analysis

---

## 🔧 Updating Your App

Made changes to the code? Easy to redeploy:

1. Make your changes locally
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Updated feature X"
   git push
   ```
3. Render automatically detects the push and redeploys!
4. Wait ~2-3 minutes for the new version to be live

---

## 💰 Free Tier Limits

### Render Free Tier
- **750 hours/month** (plenty - basically unlimited for 1-2 users)
- **Bandwidth**: 100 GB/month (more than enough)
- **Builds**: Unlimited
- **Auto-deploy**: Yes
- **Custom domain**: Yes (optional)

**Note**: Free tier apps sleep after 15 minutes of inactivity. First request after sleep takes ~30 seconds to wake up.

### Supabase Free Tier
- **Database size**: 500 MB (plenty for this app)
- **Bandwidth**: 5 GB/month (more than enough for personal use)
- **Auth users**: Unlimited
- **API requests**: 500,000/month (way more than you'll use)

---

## 🆘 Troubleshooting

### Build Failed on Render
- Check the build logs in Render dashboard
- Common issue: Missing environment variables
- Solution: Add the two env variables from Part 2, Step 4

### Can't Log In
- Check email for verification link
- Make sure you verified your email
- Try password reset if needed

### Data Not Loading
- Open browser console (F12) and check for errors
- Verify environment variables are set correctly in Render
- Check Supabase database has tables (Table Editor in Supabase)

### App is Slow to Load
- Free tier apps sleep after inactivity
- First request after sleep takes ~30 seconds
- Subsequent requests are fast

### Database Errors
- Re-run the schema SQL in Supabase SQL Editor
- Check that all tables were created (Table Editor)
- Verify RLS policies are enabled

---

## 🔐 Security Notes

- ✅ All data is encrypted in transit (HTTPS)
- ✅ Passwords are hashed (never stored plaintext)
- ✅ Row-level security prevents users from seeing each other's data
- ✅ Environment variables are secure in Render
- ⚠️ Don't share your Supabase database password
- ⚠️ Don't commit `.env.local` to GitHub (it's in .gitignore)

---

## 📊 Monitoring Usage

### Check Supabase Usage
1. Supabase Dashboard → Reports
2. See database size, bandwidth, API calls
3. You'll be nowhere near the limits!

### Check Render Usage
1. Render Dashboard → Your service
2. See runtime hours, bandwidth
3. Monitor deployment history

---

## 🎯 Next Steps

Now that your app is live:

1. **Use it daily** - Log every purchase
2. **Review weekly** - Check your spending vs budget
3. **Update monthly** - Update asset values, review goals
4. **Adjust budgets** - Fine-tune categories as needed
5. **Set goals** - Plan for big purchases or savings

---

## 💡 Pro Tips

- **Set up recurring expenses early** - They help with budget planning
- **Link goals to assets** - Auto-sync makes tracking easier
- **Use split payments** - Great for shared meals or group expenses
- **Check dashboard weekly** - Stay on top of your finances
- **Update assets monthly** - See your wealth grow over time

---

## 🤝 Sharing with Your Girlfriend

1. Send her your app URL
2. She signs up with her own email/password
3. Each of you have separate accounts
4. Each of you can only see your own data
5. You both track finances independently!

*Optional: You could create a shared account email if you want to track finances together*

---

## ✅ Setup Complete Checklist

- [ ] Supabase account created
- [ ] Database schema run successfully
- [ ] API keys copied
- [ ] Code pushed to GitHub
- [ ] Render account created
- [ ] Web service created on Render
- [ ] Environment variables added
- [ ] App deployed successfully
- [ ] Signed up on the live app
- [ ] Email verified
- [ ] Categories created
- [ ] First purchase added
- [ ] Recurring expenses set up
- [ ] Income added
- [ ] Ready to track finances! 🎉

---

**Questions?** Check the main README.md for more details!

**Your app is now live at**: `https://YOUR-APP-NAME.onrender.com`

Congratulations! You're now tracking your finances like a pro! 💰📊
