# Finance Tracker

A full-stack personal finance web app built with Next.js, Supabase, and Tailwind CSS. Track expenses, manage budgets, monitor assets, and set financial goals.

## Features

✅ **Expense Tracking**
- Add purchases with categories
- Split payment support (track money owed back)
- View transaction history with filters
- Monthly budget tracking per category

✅ **Recurring Expenses**
- Set up monthly, weekly, or yearly bills
- Track subscriptions and fixed costs
- Pause/activate recurring expenses
- Auto-calculate monthly totals

✅ **Income Tracking**
- Record one-time and recurring income
- Track multiple income sources
- View monthly income totals
- Compare income vs spending

✅ **Monthly History & Excel Export**
- Browse any past month's complete financial snapshot
- Compare month-over-month changes
- See spending trends and patterns
- Export any month to Excel with:
  - Summary sheet (income, spending, cashflow)
  - Detailed transactions
  - Budget breakdown by category
  - Assets snapshot

✅ **Assets Management**
- Track savings accounts, investments, etc.
- Update values monthly
- View complete history with growth/decline

✅ **Financial Goals**
- Set target amounts and deadlines
- Link goals to assets for auto-sync
- Calculate monthly savings needed
- Track progress with visual indicators

✅ **Dashboard Overview**
- Income vs spending comparison
- Net cashflow tracking
- Budget progress by category
- Recent transactions

✅ **Secure Authentication**
- Email/password signup and login
- Row-level security (RLS)
- Each user only sees their own data

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Deployment**: Vercel (frontend) + Supabase (backend)
- **Charts**: Recharts
- **Icons**: Lucide React

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd finance-tracker
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to **Project Settings** → **API**
4. Copy your **Project URL** and **anon public key**

### 4. Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Open the file `supabase-schema.sql` from this repo
3. Copy and paste the entire content into the SQL Editor
4. Click **Run** to create all tables, policies, and triggers

### 5. Configure Environment Variables

1. Copy the example env file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage Guide

### First Time Setup

1. **Sign Up**: Create an account with email and password
2. **Create Categories**: Go to Settings and add your spending categories (e.g., Groceries, Dining Out, Transportation)
3. **Set Budgets**: Assign monthly budget amounts to each category

### Adding Purchases

1. Click **"Add Purchase"** button or the **+** icon in the bottom nav
2. Enter the total amount, category, description, and date
3. **Split Payments** (optional):
   - Toggle "Split Payment" ON
   - Enter the amount you'll be paid back
   - Enter number of people who owe you
   - The app calculates your actual cost automatically

### Managing Assets

1. Go to **Assets** page
2. Click **"New Asset"** to add an account (e.g., "HYSA")
3. Enter current value
4. Update monthly by clicking the asset and entering new value
5. View complete history of value changes

### Setting Goals

1. Go to **Goals** page
2. Click **"New Goal"**
3. Set:
   - Goal name (e.g., "Emergency Fund")
   - Target amount
   - Current amount
   - Deadline date
   - Linked asset (optional - syncs current amount automatically)
4. The app shows:
   - Progress percentage
   - Amount remaining
   - Months left
   - **Monthly savings needed** to hit goal on time

## Database Schema

### Tables

- **users** - User profiles (extends Supabase auth)
- **categories** - Spending categories with budgets
- **purchases** - All transactions with split payment support
- **assets** - Savings accounts, investments, etc.
- **asset_history** - Historical values for tracking growth
- **goals** - Financial goals with deadlines

### Key Features

- **Row Level Security (RLS)**: Users can only access their own data
- **Automatic profile creation**: Trigger creates user profile on signup
- **Foreign key constraints**: Maintains data integrity
- **Indexed queries**: Fast lookups on common queries

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click **Deploy**

Your app will be live at `your-app.vercel.app`!

### Supabase is Already Deployed

Your Supabase project is already hosted and production-ready. No additional deployment needed for the backend.

## Project Structure

```
finance-tracker/
├── app/
│   ├── dashboard/           # Main app pages
│   │   ├── add/            # Add purchase page
│   │   ├── assets/         # Assets tracking
│   │   ├── goals/          # Financial goals
│   │   ├── settings/       # Category management
│   │   ├── transactions/   # Transaction history
│   │   └── page.tsx        # Dashboard home
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Login page
├── lib/
│   └── supabase.ts         # Supabase client & types
├── supabase-schema.sql     # Database schema
└── README.md               # This file
```

## Customization

### Adding New Categories

Go to Settings → Add Category
- Choose a name
- Set monthly budget
- Pick a color

### Changing Colors

Edit the `PRESET_COLORS` array in:
- `app/dashboard/settings/page.tsx`

### Modifying Budgets

Click on any category in Settings and update the budget amount inline.

## Troubleshooting

**Can't login after signup?**
- Check your email for verification link
- Supabase requires email verification by default

**Categories not showing?**
- Make sure you created categories in Settings first
- Check browser console for errors

**Data not loading?**
- Verify `.env.local` has correct Supabase credentials
- Check Supabase dashboard → Table Editor to see if data exists
- Review RLS policies in SQL Editor

**"Failed to add purchase" error?**
- Ensure you have at least one category created
- Check that all required fields are filled

## Future Enhancements

Ideas for extending the app:
- 📊 Charts and visualizations (spending trends, budget vs actual)
- 📱 Mobile app (React Native)
- 🔔 Budget alerts and notifications
- 💳 Bank account integration (Plaid)
- 📄 Export to CSV/PDF
- 🎯 Recurring transactions
- 👥 Shared budgets for couples
- 📈 Investment tracking

## License

MIT

## Support

For questions or issues, please open an issue on GitHub.

---

Built with ❤️ using Next.js and Supabase
