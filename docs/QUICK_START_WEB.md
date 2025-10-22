# 🌐 Quick Start: Web App

This guide will help you run just the web application.

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- Convex account (free at <https://convex.dev>)
- Clerk account (free at <https://clerk.com>)

## Step 1: Install Dependencies

```bash
# From the root of the project
pnpm install
```

## Step 2: Set Up Convex Backend

```bash
# Navigate to backend package
cd packages/backend

# Login to Convex (opens browser)
npx convex login

# Start Convex dev server
npx convex dev
```

Keep this terminal open! Copy the `CONVEX_URL` that appears.

## Step 3: Set Up Clerk

1. Go to <https://dashboard.clerk.com>
2. Create a new application
3. Choose "Email" and "Google" as sign-in methods
4. Copy your **Publishable Key** (starts with `pk_test_`)
5. Copy your **Secret Key** (starts with `sk_test_`)

## Step 4: Configure Environment Variables

Copy the example file and fill in your values:

```bash
# From the root of the project
cp apps/web/.env.example apps/web/.env.local
```

Then edit `apps/web/.env.local` with your actual values:

```env
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_CLERK_FRONTEND_API_URL=https://your-clerk-frontend-api.clerk.accounts.dev

CLERK_SECRET_KEY=sk_test_xxxxx
```

**Note**: See `apps/web/.env.example` for the required variables.

## Step 5: Connect Clerk to Convex

1. In Clerk dashboard → **JWT Templates** → **New Template** → **Convex**
2. Copy the **JWKS Endpoint URL**
3. In Convex dashboard → **Settings** → **Authentication** → **Add Provider**
4. Select **Clerk** and paste the JWKS URL

## Step 6: Run the Web App

Open a new terminal (keep Convex running in the other):

```bash
# From the root of the project
pnpm dev:web
```

The app will open at <http://localhost:5173>

## What You Can Do Now

### Without API Keys

- Sign up / Sign in
- View the UI
- Navigate between pages

### With OpenAI API Key

Set in Convex environment:

```bash
cd packages/backend
npx convex env set OPENAI_API_KEY "sk-xxxxx"
```

**Note**: See `packages/backend/.env.example` for all available backend environment variables.

Now you can:

- Create conversations
- Upload audio files
- Get AI-powered transcriptions
- See speech analytics

### With Speechmatics API Key

Set in Convex environment:

```bash
cd packages/backend
npx convex env set SPEECHMATICS_API_KEY "your_key"
```

Now you can:

- Real-time transcription
- Speaker diarization
- Better transcription quality

## Common Commands

```bash
# Start web app only
pnpm dev:web

# Build for production
pnpm build:web

# Type check
cd apps/web && pnpm typecheck

# View Convex logs
cd packages/backend && npx convex logs

# View Convex dashboard
cd packages/backend && npx convex dashboard
```

## Troubleshooting

### Port 5173 already in use

```bash
# Kill the process
kill -9 $(lsof -ti:5173)

# Or use a different port
PORT=3000 pnpm dev:web
```

### "Cannot find module '@audora/backend'"

```bash
# Make sure Convex is running
cd packages/backend
npx convex dev
```

### Changes not appearing

1. Check for errors in terminal
2. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
3. Clear browser cache
4. Restart dev server

### Authentication not working

1. Verify Clerk keys in `.env.local`
2. Check JWT template is configured
3. Clear cookies and sign in again

## Next Steps

- Read [Architecture Overview](../ARCHITECTURE.md) to understand how it works
- Explore the code in `apps/web/app/routes/`
- Check [Troubleshooting Guide](../TROUBLESHOOTING.md) for common issues
- Try adding a new page or component

Happy coding! 🚀
