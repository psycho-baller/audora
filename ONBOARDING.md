# 🎯 Audora Onboarding Checklist

Welcome to the Audora team! This checklist will help you get set up and productive quickly.

## ✅ Pre-Setup Checklist

### Required Software

- [ ] **Node.js 18+** installed ([nodejs.org](https://nodejs.org/))
  - Verify: `node --version`
- [ ] **pnpm** installed
  - Install: `npm install -g pnpm`
  - Verify: `pnpm --version`
- [ ] **Git** installed
  - Verify: `git --version`

### Required Accounts (All Free Tiers Available)

- [ ] **Convex** account ([convex.dev](https://convex.dev))
- [ ] **Clerk** account ([clerk.com](https://clerk.com))
- [ ] **OpenAI** account ([platform.openai.com](https://platform.openai.com))
  - Note: Requires payment for API usage
- [ ] **Speechmatics** account (optional) ([speechmatics.com](https://www.speechmatics.com/))
  - Free trial available

### Optional (For Mobile Development)

- [ ] **Xcode** (Mac only, for iOS development)
- [ ] **Android Studio** (for Android development)
- [ ] **Expo Go** app on your phone

---

## 📖 Step 1: Read the Documentation

Start by understanding what Audora is and how it works:

- [ ] Read [README.md](./README.md) - Project overview
- [ ] Read [GETTING_STARTED.md](./GETTING_STARTED.md) - Complete setup guide
- [ ] Skim [ARCHITECTURE.md](./ARCHITECTURE.md) - Tech stack overview

**Time estimate**: 20-30 minutes

---

## 🛠️ Step 2: Initial Setup

### Clone and Install

- [ ] Clone the repository

  ```bash
  git clone <repository-url>
  cd audora
  ```

- [ ] Install dependencies

  ```bash
  pnpm install
  ```

### Set Up Convex Backend

- [ ] Navigate to backend

  ```bash
  cd packages/backend
  ```

- [ ] Login to Convex

  ```bash
  npx convex login
  ```

- [ ] Start Convex dev server

  ```bash
  npx convex dev
  ```

- [ ] Copy the `CONVEX_URL` that appears (you'll need this)

---

## 🔐 Step 3: Configure Authentication

### Set Up Clerk

- [ ] Go to [dashboard.clerk.com](https://dashboard.clerk.com)
- [ ] Create a new application
- [ ] Choose "Email" and "Google" as sign-in methods
- [ ] Copy your **Publishable Key** (starts with `pk_test_`)
- [ ] Copy your **Secret Key** (starts with `sk_test_`)

### Connect Clerk to Convex

- [ ] In Clerk dashboard → **JWT Templates** → **New Template** → **Convex**
- [ ] Copy the **JWKS Endpoint URL**
- [ ] In Convex dashboard → **Settings** → **Authentication** → **Add Provider**
- [ ] Select **Clerk** and paste the JWKS URL

---

## ⚙️ Step 4: Configure Environment Variables

### Web App

- [ ] Copy example file

  ```bash
  cp apps/web/.env.example apps/web/.env.local
  ```

- [ ] Edit `apps/web/.env.local` with your values:
  - `VITE_CONVEX_URL` - From Convex dashboard
  - `VITE_CLERK_PUBLISHABLE_KEY` - From Clerk
  - `VITE_CLERK_FRONTEND_API_URL` - From Clerk
  - `CLERK_SECRET_KEY` - From Clerk

### Mobile App (Optional)

- [ ] Copy example file

  ```bash
  cp apps/expo/.env.example apps/expo/.env.local
  ```

- [ ] Edit `apps/expo/.env.local` with your values:
  - `EXPO_PUBLIC_CONVEX_URL` - From Convex dashboard
  - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` - From Clerk

### Backend (Convex)

- [ ] Set OpenAI API key

  ```bash
  cd packages/backend
  npx convex env set OPENAI_API_KEY "sk-xxxxx"
  ```

- [ ] (Optional) Set Speechmatics API key

  ```bash
  npx convex env set SPEECHMATICS_API_KEY "your_key"
  ```

**Time estimate**: 10-15 minutes

---

## 🚀 Step 5: Run the Application

### Start Web App

- [ ] Open a new terminal (keep Convex running)
- [ ] Run web app

  ```bash
  pnpm dev:web
  ```

- [ ] Open browser to `http://localhost:5173`
- [ ] Sign up / Sign in to test authentication

### Start Mobile App (Optional)

- [ ] Run mobile app

  ```bash
  pnpm dev:expo
  ```

- [ ] Scan QR code with Expo Go app
- [ ] Or press `i` for iOS simulator / `a` for Android emulator

---

## ✨ Step 6: Verify Everything Works

- [ ] **Authentication**: Can you sign up and sign in?
- [ ] **Web App**: Does the dashboard load?
- [ ] **Mobile App** (if applicable): Does it load on your device?
- [ ] **Convex**: Check Convex dashboard - do you see your user?

---

## 📚 Step 7: Explore the Codebase

### Understand the Structure

- [ ] Review the monorepo structure in [ARCHITECTURE.md](./ARCHITECTURE.md)
- [ ] Explore `apps/web/app/routes/` - Web pages
- [ ] Explore `apps/expo/app/` - Mobile screens
- [ ] Explore `packages/backend/convex/` - Backend functions

### Make a Small Change

- [ ] Try changing some text in the UI
- [ ] See it hot-reload automatically
- [ ] Commit your change (if you want)

---

## 🎓 Step 8: Learn the Workflow

### Development Commands

Familiarize yourself with these commands:

```bash
# Start everything
pnpm dev

# Start specific apps
pnpm dev:web        # Web only
pnpm dev:expo       # Mobile only
pnpm dev:backend    # Backend only

# run a combination of apps
pnpm dev          # Web + Mobile + Backend
pnpm dev:web      # Web + Backend
pnpm dev:expo     # Mobile + Backend

# Build
pnpm build

# Reset (when things go wrong)
pnpm reset          # Clear caches and reinstall
pnpm clean          # Remove all node_modules
```

### Useful Resources

- [ ] Bookmark [Convex docs](https://docs.convex.dev/)
- [ ] Bookmark [Expo docs](https://docs.expo.dev/)
- [ ] Join [Convex Discord](https://convex.dev/community) for help

---

## 🐛 Troubleshooting

If you run into issues:

1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Check [FAQ.md](./FAQ.md)
3. Try `pnpm reset`
4. Ask the team!

### Common Issues

**Port already in use:**

```bash
kill -9 $(lsof -ti:5173)
```

**Convex not connecting:**

- Make sure `npx convex dev` is running
- Check your `CONVEX_URL` in `.env.local`

**Authentication not working:**

- Verify Clerk keys in `.env.local`
- Check JWT template is configured
- Clear cookies and try again

---

## ✅ Final Checklist

Before you start working on tasks:

- [ ] Can you run the web app locally?
- [ ] Can you sign in with authentication?
- [ ] Can you see data in Convex dashboard?
- [ ] Do you understand the monorepo structure?
- [ ] Have you read the architecture docs?
- [ ] Do you know where to find help?

---

## 🎉 You're Ready

**Total estimated setup time**: 2-3 hours

You're now ready to start contributing to Audora! If you have any questions:

1. Check the documentation
2. Ask your team members
3. Open a GitHub issue
4. Join the Convex Discord

**Next steps:**

- Pick up your first task
- Ask questions when stuck
- Make your first PR
- Help improve the docs!

Welcome to the team! 🚀
