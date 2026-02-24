# Netlify Deployment Guide

## Quick Start

Your project is now configured for Netlify deployment. Follow these steps:

### 1. Push to Git Repository

```bash
git add .
git commit -m "Configure for Netlify deployment"
git push origin main
```

### 2. Deploy to Netlify

#### Option A: Via Netlify Dashboard (Easiest)

1. Go to https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Connect your Git provider (GitHub/GitLab/Bitbucket)
4. Select your repository
5. Netlify will auto-detect settings from `netlify.toml`
6. Click "Deploy site"

#### Option B: Via Netlify CLI

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login to Netlify
netlify login

# Navigate to project root
cd /Users/macbook/Downloads/agentic-edi-platform-source

# Initialize and deploy
netlify init
netlify deploy --prod
```

## Build Configuration

The project is configured with:

- **Base Directory:** `frontend`
- **Build Command:** `npm install --legacy-peer-deps && npm run build`
- **Publish Directory:** `frontend/build`
- **Node Version:** 18.x

All settings are in `netlify.toml` at the project root.

## Important Files Created

1. **`netlify.toml`** - Netlify configuration file
   - Build settings
   - Redirect rules for React Router
   - Security headers
   - Cache control headers

2. **`frontend/public/_redirects`** - SPA routing support
   - Ensures all routes redirect to `index.html` for client-side routing

3. **`.gitignore`** - Git ignore file
   - Excludes build artifacts and dependencies

## Verification

The build has been tested locally and is working correctly:

```
✓ Build completed successfully
✓ Output: frontend/build/
✓ Main bundle: ~179 KB (gzipped)
✓ CSS bundle: ~12 KB (gzipped)
```

## Post-Deployment

After deployment:

1. **Test your routes** - Navigate to different pages to ensure React Router works
2. **Check console** - Verify no errors in browser console
3. **Test functionality** - Ensure all features work correctly

## Environment Variables (Optional)

If you need environment variables:

1. Go to Netlify Dashboard → Site Settings → Environment Variables
2. Add variables with prefix `REACT_APP_` (e.g., `REACT_APP_API_URL`)

## Custom Domain

To add a custom domain:

1. Netlify Dashboard → Domain Settings → Add custom domain
2. Follow DNS configuration instructions
3. SSL certificate is automatically provisioned

## Troubleshooting

### Build Fails
- Check build logs in Netlify Dashboard
- Ensure Node version is 18.x
- Verify all dependencies are installed

### Routes Return 404
- Verify `_redirects` file exists in `frontend/public/`
- Check `netlify.toml` redirect rules

### Assets Not Loading
- Ensure build completed successfully
- Check browser console for errors
- Verify paths are relative (not absolute)

## Support

- [Netlify Documentation](https://docs.netlify.com/)
- [React Router Deployment](https://reactrouter.com/en/main/start/overview#deployment)
- [Create React App Deployment](https://cra.link/deployment)
