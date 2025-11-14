# Deployment Guide for Calorie Macro Tracker

## Option 1: Deploy to Vercel (Recommended - Easiest)

### Using Vercel CLI
1. Install Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```

2. Navigate to your project directory:
   ```bash
   cd /path/to/calorie-tracker
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Follow the prompts:
   - Login/Signup to Vercel
   - Confirm project settings
   - Deploy!

### Using Vercel Dashboard (No CLI needed)
1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click "Add New" → "Project"
3. Import your Git repository
4. Vercel will auto-detect the Vite configuration
5. Click "Deploy"

Your app will be live at: `https://your-project-name.vercel.app`

---

## Option 2: Deploy to Netlify

### Using Netlify CLI
1. Install Netlify CLI globally:
   ```bash
   npm install -g netlify-cli
   ```

2. Navigate to your project directory:
   ```bash
   cd /path/to/calorie-tracker
   ```

3. Login to Netlify:
   ```bash
   netlify login
   ```

4. Initialize and deploy:
   ```bash
   netlify init
   ```

5. Follow the prompts to create a new site

### Using Netlify Dashboard (Drag & Drop)
1. Build your project locally:
   ```bash
   npm run build
   ```

2. Go to [netlify.com](https://netlify.com) and sign up/login
3. Drag and drop the `dist` folder to the Netlify dashboard

### Using Git Integration
1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [netlify.com](https://netlify.com) and sign up/login
3. Click "Add new site" → "Import an existing project"
4. Connect to your Git provider
5. Select your repository
6. Netlify will auto-detect the build settings from `netlify.toml`
7. Click "Deploy"

Your app will be live at: `https://your-site-name.netlify.app`

---

## Option 3: GitHub Pages

1. Update `vite.config.ts` to add base path:
   ```typescript
   export default defineConfig({
     base: '/your-repo-name/',
     // ... rest of config
   })
   ```

2. Install gh-pages:
   ```bash
   npm install --save-dev gh-pages
   ```

3. Add deploy script to `package.json`:
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```

4. Deploy:
   ```bash
   npm run deploy
   ```

Your app will be live at: `https://username.github.io/repo-name/`

---

## Recommended: Vercel
- ✅ Zero configuration
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Auto-deploys on git push
- ✅ Free for personal projects
- ✅ Fastest deployment time

## Notes
- All platforms offer free tiers for personal projects
- Your data will persist using browser localStorage
- The app is fully client-side, no backend needed
