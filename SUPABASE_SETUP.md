# Supabase Setup Guide for Calorie Macro Tracker

Your app now uses **Supabase** for cloud storage! This means:
- ✅ Your data is backed up in the cloud
- ✅ Access your data from any device
- ✅ Secure user authentication
- ✅ Data persists even if you clear browser cache

## Step 1: Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "Sign Up"
3. Sign up with GitHub, Google, or email

## Step 2: Create a New Project

1. Once logged in, click "New Project"
2. Fill in the project details:
   - **Name**: `calorie-tracker` (or any name you prefer)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose the region closest to you
   - **Pricing Plan**: Select "Free" (includes 500MB database, 50,000 monthly active users)
3. Click "Create new project"
4. Wait 2-3 minutes for the project to be set up

## Step 3: Set Up the Database

1. In your Supabase project dashboard, click on the **SQL Editor** tab (left sidebar)
2. Click "New query"
3. Copy the entire contents of the `supabase-schema.sql` file from this project
4. Paste it into the SQL Editor
5. Click "Run" to execute the SQL
6. You should see a success message confirming tables and policies were created

## Step 4: Get Your API Keys

1. In your Supabase project, click on the **Settings** icon (gear icon in left sidebar)
2. Click on **API** in the settings menu
3. You'll see two important values:
   - **Project URL**: Something like `https://xxxxxxxxxxxxx.supabase.co`
   - **anon/public key**: A long string starting with `eyJ...`

## Step 5: Configure Environment Variables

1. Create a `.env` file in the root of your project (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

2. Open the `.env` file and add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project-url.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **IMPORTANT**: Never commit the `.env` file to git! It's already in `.gitignore`.

## Step 6: Deploy with Environment Variables

### For Vercel:
1. Go to your project on [vercel.com](https://vercel.com)
2. Go to Settings → Environment Variables
3. Add two variables:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
4. Redeploy your app

### For Netlify:
1. Go to your site on [netlify.com](https://netlify.com)
2. Go to Site settings → Environment variables
3. Add two variables:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
4. Trigger a new deploy

## Step 7: Test Your App

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open your app in the browser
3. You should see a login/signup screen
4. Create an account with your email
5. Check your email for a confirmation link (check spam folder too!)
6. Click the confirmation link
7. Log in to your app

## Data Migration

If you had data in localStorage before:
- The app will **automatically migrate** your old data to Supabase on first login
- This happens only once
- After migration, you can safely use the app on any device!

## Security Features

Your app includes:
- **Row Level Security (RLS)**: Users can only see their own data
- **Email confirmation**: New users must confirm their email
- **Secure authentication**: Passwords are hashed and secure
- **API key protection**: Keys are kept on the server, never exposed

## Troubleshooting

### "Failed to fetch" errors
- Check that your `.env` file has the correct Supabase URL and key
- Make sure you ran the SQL schema in Supabase
- Verify your Supabase project is active

### Email confirmation not received
- Check your spam folder
- In Supabase dashboard, go to Authentication → Settings
- You can disable email confirmation for testing (not recommended for production)

### Can't log in
- Make sure you confirmed your email
- Try resetting your password
- Check the browser console for errors

## Support

For Supabase-specific issues, check:
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)

## Free Tier Limits

Supabase free tier includes:
- 500MB database space
- 1GB file storage
- 50,000 monthly active users
- 2GB bandwidth

This is more than enough for personal use!
