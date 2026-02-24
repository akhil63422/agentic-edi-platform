# Deploy to Netlify

## Prerequisites

1. **Backend deployed** – The FastAPI backend must be hosted elsewhere (e.g. [Render](https://render.com), [Railway](https://railway.app), [Fly.io](https://fly.io)). Netlify hosts only the frontend.

2. **MongoDB** – Use [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier) and set `MONGODB_URL` in your backend's environment.

---

## Deploy Frontend to Netlify

### Option A: Deploy via Netlify UI

1. Push this repo to GitHub/GitLab/Bitbucket.

2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**.

3. Connect your repo. Netlify will detect `netlify.toml` and use:
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `frontend/build`

4. **Environment variables** (Site settings → Environment variables):
   - `REACT_APP_BACKEND_URL` = `https://your-backend.onrender.com/api/v1`  
     (Replace with your actual backend URL.)

5. Click **Deploy site**.

---

### Option B: Deploy via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# From project root
cd frontend
npm run build

# Deploy
netlify deploy --prod --dir=build
```

Set `REACT_APP_BACKEND_URL` in the Netlify dashboard before deploying.

---

## After Deployment

- Your app will be at `https://your-site.netlify.app`.
- Share this link + the JSON export file with your manager.
- Manager can use **Import Data** on the Dashboard to load the demo data.
