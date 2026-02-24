# Deploying to Netlify

This guide will help you deploy the Agentic EDI Platform to Netlify.

## Prerequisites

- A Netlify account (sign up at https://www.netlify.com)
- Git repository (GitHub, GitLab, or Bitbucket)

## Deployment Steps

### Option 1: Deploy via Netlify UI (Recommended)

1. **Push your code to Git**
   ```bash
   git add .
   git commit -m "Prepare for Netlify deployment"
   git push origin main
   ```

2. **Connect to Netlify**
   - Go to https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Connect your Git provider (GitHub/GitLab/Bitbucket)
   - Select your repository

3. **Configure Build Settings**
   Netlify will automatically detect the `netlify.toml` file, but verify these settings:
   - **Base directory:** `frontend`
   - **Build command:** `npm install --legacy-peer-deps && npm run build`
   - **Publish directory:** `frontend/build`

4. **Deploy**
   - Click "Deploy site"
   - Netlify will build and deploy your site
   - Your site will be live at `https://your-site-name.netlify.app`

### Option 2: Deploy via Netlify CLI

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**
   ```bash
   netlify login
   ```

3. **Initialize Netlify**
   ```bash
   cd frontend
   netlify init
   ```
   - Choose "Create & configure a new site"
   - Follow the prompts

4. **Build and Deploy**
   ```bash
   npm install --legacy-peer-deps
   npm run build
   netlify deploy --prod
   ```

## Build Configuration

The project uses the following configuration:

- **Build Command:** `npm install --legacy-peer-deps && npm run build`
- **Publish Directory:** `frontend/build`
- **Node Version:** 18.x (configured in netlify.toml)

## Environment Variables

If you need to set environment variables:

1. Go to Netlify Dashboard → Site Settings → Environment Variables
2. Add any required variables (e.g., `REACT_APP_API_URL`)

## Custom Domain

To add a custom domain:

1. Go to Netlify Dashboard → Domain Settings
2. Click "Add custom domain"
3. Follow the DNS configuration instructions

## Continuous Deployment

Netlify automatically deploys when you push to your main branch. To change this:

1. Go to Site Settings → Build & Deploy → Continuous Deployment
2. Configure branch and build settings

## Troubleshooting

### Build Fails

- Check the build logs in Netlify Dashboard
- Ensure Node version is 18.x or compatible
- Verify all dependencies are in `package.json`

### Routes Not Working

- Ensure `_redirects` file exists in `frontend/public/`
- Verify `netlify.toml` has the redirect rule for SPA routing

### Assets Not Loading

- Check that build completed successfully
- Verify paths in `index.html` are relative (not absolute)
- Check browser console for 404 errors

## Support

For more information, visit:
- [Netlify Documentation](https://docs.netlify.com/)
- [React Router Deployment](https://reactrouter.com/en/main/start/overview#deployment)
