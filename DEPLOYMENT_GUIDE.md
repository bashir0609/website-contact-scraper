# Next.js Contact Scraper - Vercel Deployment Guide

## 📁 Project Structure

Create this folder structure:

```
contact-scraper-nextjs/
├── pages/
│   ├── api/
│   │   ├── scrape.js
│   │   └── discover-links.js
│   └── index.js
├── components/
│   ├── ScraperUI.js
│   └── CsvUpload.js
├── utils/
│   ├── domainUtils.js
│   └── csvExportUtils.js
├── styles/
│   └── globals.css
├── package.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
└── .env.local
```

## 🚀 Setup Steps

### 1. Initialize Next.js Project
```bash
npx create-next-app@latest contact-scraper-nextjs
cd contact-scraper-nextjs
```

### 2. Install Dependencies
```bash
npm install cheerio node-fetch papaparse lucide-react react-dropzone
npm install -D tailwindcss postcss autoprefixer
```

### 3. Setup Tailwind CSS
```bash
npx tailwindcss init -p
```

### 4. Copy Files
- Replace `package.json` with the artifact version
- Copy all API routes to `pages/api/`
- Copy components to `components/`
- Copy utils to `utils/`
- Copy your existing `ScraperUI.js` and `CsvUpload.js`

### 5. Create Environment File
Create `.env.local`:
```
REACT_APP_API_NINJAS_KEY=your_api_key_here
```

### 6. Update Styles
Create `styles/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gradient-to-br from-blue-500 to-indigo-700 text-slate-800;
}
```

### 7. Update Tailwind Config
Use your existing `tailwind.config.js` but update content paths:
```javascript
content: [
  "./pages/**/*.{js,ts,jsx,tsx}",
  "./components/**/*.{js,ts,jsx,tsx}",
],
```

## 🔧 Key Changes from React to Next.js

### 1. API Calls
```javascript
// Before (React):
fetch('http://localhost:8000/scrape', ...)

// After (Next.js):
fetch('/api/scrape', ...)
```

### 2. File Structure
- `src/App.js` → `pages/index.js`
- `server.js` → `pages/api/scrape.js` + `pages/api/discover-links.js`
- Components stay in `components/`
- Utils stay in `utils/`

### 3. No Express Server
- Next.js handles API routes automatically
- No need to run separate backend server
- Environment variables work the same way

## 🌐 Deploy to Vercel

### Option A: GitHub Deploy (Recommended)
1. Push code to GitHub repository
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repo
4. Add environment variable: `REACT_APP_API_NINJAS_KEY`
5. Deploy!

### Option B: CLI Deploy
```bash
npm install -g vercel
vercel
# Follow prompts, add environment variables
```

### Option C: Manual Deploy
1. Run `npm run build`
2. Upload build folder to Vercel dashboard
3. Configure environment variables

## ⚙️ Environment Variables in Vercel

In Vercel dashboard:
1. Go to Project Settings
2. Environment Variables
3. Add: `REACT_APP_API_NINJAS_KEY` = `your_api_key`
4. Redeploy

## 🧪 Test Locally

```bash
npm run dev
# App runs on http://localhost:3000
```

## 🎯 Benefits of Next.js Version

✅ **Single Deployment** - No separate frontend/backend
✅ **Serverless Functions** - Auto-scaling API routes
✅ **Better Performance** - Built-in optimizations
✅ **Easy Vercel Deploy** - One-click deployment
✅ **Same Features** - All scraping functionality preserved

## 🔍 Troubleshooting

**API Key Issues:**
- Make sure `.env.local` has correct key
- In Vercel, add environment variable
- Redeploy after adding env vars

**Build Errors:**
- Check all imports are correct
- Ensure all components exist
- Verify API routes syntax

**Scraping Issues:**
- Same as before - check API Ninjas limits
- Monitor Vercel function logs
