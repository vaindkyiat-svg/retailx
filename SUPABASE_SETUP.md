# Supabase Setup Guide for RetailX

This guide will help you set up Supabase for the RetailX retail management system.

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in or create an account
2. Click "New Project"
3. Enter a project name (e.g., "retailx")
4. Set a secure database password
5. Choose your region
6. Click "Create new project"

## Step 2: Get Your API Credentials

1. Once your project is created, go to **Settings → API**
2. Copy these values:
   - **Project URL**: This is your `VITE_SUPABASE_URL`
   - **Anon Public Key**: This is your `VITE_SUPABASE_ANON_KEY`

## Step 3: Configure Environment Variables

1. Open `.env.local` in your project root
2. Replace the placeholder values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

## Step 4: Create Database Schema

### Option A: Using Supabase Dashboard

1. Go to your Supabase project
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `src/lib/schema.sql`
5. Paste it into the SQL editor
6. Click **Run**

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Link your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

## Step 5: Install Dependencies

```bash
pnpm install
```

## Step 6: Enable Authentication (Optional but Recommended)

If you want to use Supabase authentication:

1. Go to your Supabase project
2. Navigate to **Authentication → Providers**
3. Enable the authentication providers you want (Email, Google, GitHub, etc.)
4. In **Email/Password**, enable "Enable Email Signup" and "Enable Email Confirmations"

## Step 7: Set Up Row Level Security (RLS)

The schema includes RLS policies for basic security. You may need to customize these based on your authentication model.

To test without RLS initially:
1. Go to **SQL Editor**
2. Run:

```sql
ALTER TABLE public.shops DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wastage_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawer_days DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawer_transactions DISABLE ROW LEVEL SECURITY;
```

## Step 8: Create Initial Shop Data

You can insert test data using the Supabase dashboard or the following SQL:

```sql
INSERT INTO public.shops (name, owner_name, owner_phone, address, gst_no, owner_email) VALUES
('Main Store', 'John Doe', '9876543210', '123 Main Street, City', '18AABCT0055K1Z0', 'john@example.com'),
('Branch Store', 'Jane Smith', '9876543211', '456 Branch Road, City', '18AABCT0055K1Z1', 'jane@example.com');
```

## Step 9: Verify Setup

1. Run your development server:
```bash
pnpm dev
```

2. Open your application in the browser

3. Check the browser console for any Supabase connection errors

## Database Schema Overview

### Core Tables:
- **shops**: Store/business locations
- **products**: Product inventory
- **batches**: Batch tracking with expiry dates
- **orders**: Sales/billing records
- **refunds**: Refund records
- **wastage_entries**: Wastage/loss tracking
- **drawer_days**: Cash drawer opening/closing
- **drawer_transactions**: Individual drawer transactions

## Key Features:

✅ Multi-tenant (multiple shops)
✅ Real-time sync with Supabase
✅ Row-level security for data isolation
✅ Batch expiry tracking
✅ Complete audit trail with timestamps
✅ JSONB storage for complex data

## Troubleshooting

### "Missing Supabase environment variables" error:
- Check that `.env.local` has the correct values
- Restart your development server after updating `.env.local`

### Connection errors:
- Verify your VITE_SUPABASE_URL is correct (check for typos)
- Ensure your project is running and not paused
- Check browser console for specific error messages

### Schema creation failed:
- Try creating tables one at a time if the full migration fails
- Check for duplicate table names or existing constraints

### Permission denied errors:
- Disable RLS temporarily to test (see Step 7 above)
- Review and update RLS policies for your authentication model

## Next Steps

1. Update `src/app/App.tsx` to use the Supabase functions from `src/lib/database.ts`
2. Add user authentication using Supabase Auth
3. Implement real-time updates using Supabase subscriptions
4. Set up proper error handling and loading states
5. Add data validation and business logic rules

## Important Notes

- Keep your `VITE_SUPABASE_ANON_KEY` secure - never commit `.env.local` to version control
- Implement proper RLS policies before going to production
- Use a service role key for administrative operations (not the anon key)
- Set up backups in Supabase dashboard settings
- Monitor your usage in Supabase dashboard to stay within free tier limits
