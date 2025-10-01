# Deployment Guide

## Quick Deploy to Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy to production**:
   ```bash
   npm run deploy
   ```

   Or for preview deployment:
   ```bash
   npm run deploy:preview
   ```

## Manual Steps

If you prefer manual deployment:

1. **Build the web version**:
   ```bash
   npm run build:web
   ```

2. **Deploy with Vercel**:
   ```bash
   vercel --prod
   ```

## Configuration

The deployment is configured with:
- **Build Command**: `npx expo export --platform web --output-dir dist`
- **Output Directory**: `dist`
- **API Functions**: Serverless functions in `/api`
- **Runtime**: Node.js 20.x

## Environment Variables

If you need environment variables in production, add them in your Vercel dashboard:
- Go to your project settings
- Navigate to "Environment Variables"
- Add any required variables

## Troubleshooting

1. **Backend not responding**: Check the Vercel function logs in your dashboard
2. **CORS issues**: The API is configured to allow Vercel domains automatically
3. **Build failures**: Check that all dependencies are in `package.json`

## Domain Setup

After deployment:
1. Go to your Vercel dashboard
2. Navigate to your project
3. Go to "Domains" tab
4. Add your custom domain if needed