# 🔧 Troubleshooting Guide

Common issues and their solutions when working with Audora.

## 📋 Table of Contents

1. [Installation Issues](#installation-issues)
2. [Convex Issues](#convex-issues)
3. [Authentication Issues](#authentication-issues)
4. [Build Issues](#build-issues)
5. [Mobile App Issues](#mobile-app-issues)
6. [API & External Services](#api--external-services)
7. [General Debugging Tips](#general-debugging-tips)

---

## 🔨 Installation Issues

### pnpm not found

**Problem**: `command not found: pnpm`

**Solution**:
```bash
npm install -g pnpm
```

### Node version too old

**Problem**: `Error: The engine "node" is incompatible with this module`

**Solution**:
1. Check your Node version: `node --version`
2. Install Node 18 or higher from <https://nodejs.org/>
3. Or use nvm: `nvm install 18 && nvm use 18`

### Permission errors during install

**Problem**: `EACCES: permission denied`

**Solution**:
```bash
# Don't use sudo! Fix npm permissions instead:
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Installation hangs or is very slow

**Problem**: Installation takes forever

**Solution**:
```bash
# Clear pnpm cache
pnpm store prune

# Try installing again
pnpm install
```

---

## 🗄️ Convex Issues

### "Convex deployment not found"

**Problem**: `Error: Deployment not found`

**Solution**:
1. Make sure you're logged in: `npx convex login`
2. Initialize Convex: `cd packages/backend && npx convex dev`
3. Check your `.env.local` has the correct `CONVEX_URL`

### Schema push fails

**Problem**: `Error: Schema validation failed`

**Solution**:
1. Check for syntax errors in `schema.ts`
2. Make sure all imports are correct
3. Run `npx convex dev` to see detailed error messages

### "Cannot find module '_generated/server'"

**Problem**: TypeScript can't find generated files

**Solution**:
```bash
cd packages/backend
npx convex dev
# Wait for "Convex functions ready" message
```

The `_generated` folder is created automatically by Convex.

### Functions not updating

**Problem**: Code changes don't appear in the app

**Solution**:
1. Check that `npx convex dev` is running
2. Look for errors in the Convex terminal
3. Check Convex dashboard for deployment status
4. Try restarting: `Ctrl+C` then `npx convex dev`

### "User not authenticated" errors

**Problem**: `Error: User not authenticated`

**Solution**:
1. Make sure you're signed in to the app
2. Check Clerk configuration (see Authentication Issues)
3. Verify JWT template is set up correctly
4. Clear browser cookies and sign in again

### Database queries return empty

**Problem**: `useQuery` returns `undefined` or empty array

**Solution**:
1. Check if data exists: `npx convex dashboard` → Data tab
2. Verify query arguments are correct
3. Check indexes are defined in schema
4. Look for errors in Convex logs: `npx convex logs`

---

## 🔐 Authentication Issues

### Clerk keys not working

**Problem**: `Invalid publishable key`

**Solution**:
1. Go to <https://dashboard.clerk.com/>
2. Select your application
3. Go to API Keys
4. Copy the **Publishable Key** (starts with `pk_test_` or `pk_live_`)
5. Update `.env.local`:
   ```env
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
   ```

### "JWT verification failed"

**Problem**: Clerk and Convex not connected

**Solution**:
1. In Clerk dashboard, go to **JWT Templates**
2. Click **New Template** → **Convex**
3. Copy the **JWKS Endpoint URL**
4. In Convex dashboard, go to **Settings** → **Authentication**
5. Click **Add Authentication Provider**
6. Select **Clerk**
7. Paste the JWKS URL
8. Save

### Sign-in redirects to wrong URL

**Problem**: After sign-in, redirected to wrong page

**Solution**:
1. Check `FRONTEND_URL` in `.env.local`
2. In Clerk dashboard, update **Allowed redirect URLs**
3. Add your local URL: `http://localhost:5173`

### "User already exists" error

**Problem**: Can't create account

**Solution**:
1. Try signing in instead of signing up
2. Use a different email address
3. Check Clerk dashboard → Users to see if account exists
4. Delete test users if needed

---

## 🏗️ Build Issues

### TypeScript errors

**Problem**: `Type 'X' is not assignable to type 'Y'`

**Solution**:
1. Make sure Convex is running: `npx convex dev`
2. Regenerate types: `Ctrl+C` then restart Convex
3. Check imports are correct
4. Run `pnpm typecheck` to see all errors

### "Module not found" errors

**Problem**: `Cannot find module '@audora/backend'`

**Solution**:
```bash
# Reinstall dependencies
pnpm install

# Build all packages
pnpm build
```

### Turbo cache issues

**Problem**: Old code still running after changes

**Solution**:
```bash
# Use the built-in reset command
pnpm reset

# Or manually clear caches
rm -rf .turbo
rm -rf node_modules/.cache

# Rebuild
pnpm build
```

### Port already in use

**Problem**: `Error: listen EADDRINUSE: address already in use :::5173`

**Solution**:
```bash
# Find process using the port
lsof -ti:5173

# Kill the process
kill -9 $(lsof -ti:5173)

# Or use a different port
PORT=3000 pnpm dev:web
```

---

## 📱 Mobile App Issues

### Expo Go not connecting

**Problem**: Can't scan QR code or app won't load

**Solution**:
1. Make sure phone and computer are on same WiFi
2. Try using tunnel mode: `pnpm dev:expo` → press `s` → select tunnel
3. Update Expo Go app to latest version
4. Restart Expo: `Ctrl+C` then `pnpm dev:expo`

### "Unable to resolve module"

**Problem**: Module resolution errors in React Native

**Solution**:
```bash
cd apps/expo

# Clear Metro cache
rm -rf .expo
rm -rf node_modules/.cache

# Reinstall
pnpm install

# Start fresh
pnpm dev
```

### iOS simulator not opening

**Problem**: Simulator doesn't start when pressing `i`

**Solution**:
1. Make sure Xcode is installed
2. Open Xcode → Preferences → Locations → Command Line Tools (select version)
3. Open simulator manually: `open -a Simulator`
4. Then press `i` in Expo terminal

### Android emulator not opening

**Problem**: Emulator doesn't start when pressing `a`

**Solution**:
1. Make sure Android Studio is installed
2. Open Android Studio → AVD Manager
3. Create/start an emulator manually
4. Then press `a` in Expo terminal

### App crashes on startup

**Problem**: App immediately crashes when opening

**Solution**:
1. Check Expo terminal for error messages
2. Look for missing environment variables
3. Verify `.env.local` exists in `apps/expo/`
4. Compare with `.env.example`: `diff apps/expo/.env.local apps/expo/.env.example`
5. Check Convex URL is correct
6. Try clearing cache: `rm -rf .expo && pnpm dev`

### Missing environment variables

**Problem**: `Error: Missing environment variable` or undefined config values

**Solution**:

1. Check if `.env.local` files exist:

   ```bash
   ls apps/web/.env.local
   ls apps/expo/.env.local
   ```

2. If missing, copy from examples:

   ```bash
   cp apps/web/.env.example apps/web/.env.local
   cp apps/expo/.env.example apps/expo/.env.local
   ```

3. Fill in your actual values
4. Restart dev server after changing environment variables

---

## 🌐 API & External Services

### OpenAI API errors

**Problem**: `Error: Invalid API key` or `Rate limit exceeded`

**Solution**:
1. Check API key is set: `npx convex env get OPENAI_API_KEY`
2. Verify key is valid at <https://platform.openai.com/api-keys>
3. Check you have credits: <https://platform.openai.com/account/billing>
4. If rate limited, wait or upgrade plan

### Speechmatics errors

**Problem**: Transcription fails

**Solution**:
1. Check API key: `npx convex env get SPEECHMATICS_API_KEY`
2. Verify key at <https://portal.speechmatics.com/>
3. Check audio format is supported (WAV, MP3, etc.)
4. Ensure audio file isn't corrupted
5. Check file size isn't too large (< 100MB recommended)

### Zep API errors

**Problem**: Knowledge graph not working

**Solution**:
1. Check API key: `npx convex env get ZEP_API_KEY`
2. Verify at <https://www.getzep.com/>
3. Check graph ID is correct
4. This is optional - app works without Zep

### CORS errors in browser

**Problem**: `Access to fetch blocked by CORS policy`

**Solution**:
1. This usually means API keys are wrong
2. Check all environment variables are set
3. Restart dev server after changing `.env.local`
4. Clear browser cache

---

## 🐛 General Debugging Tips

### Check logs

**Convex logs**:
```bash
cd packages/backend
npx convex logs
```

**Browser console**:
- Press F12 in browser
- Go to Console tab
- Look for red errors

**React Native logs**:
- Errors appear in Expo terminal
- Or shake device → Show Dev Menu → Debug

### Clear everything and start fresh

When all else fails:

```bash
# Stop all running processes (Ctrl+C in all terminals)

# Option 1: Quick reset (clears caches and reinstalls)
pnpm reset

# Option 2: Full reset (also removes lock file)
pnpm reset:full

# Option 3: Manual cleanup
rm -rf node_modules
rm -rf .turbo
rm -rf apps/web/node_modules
rm -rf apps/expo/node_modules
rm -rf apps/expo/.expo
rm -rf packages/backend/node_modules
pnpm install

# After reset, restart Convex
cd packages/backend
npx convex dev

# In another terminal, start app
pnpm dev
```

**Available reset commands:**
- `pnpm clean` - Remove all node_modules and cache folders
- `pnpm reset` - Clean + reinstall dependencies
- `pnpm reset:full` - Clean + remove lock file + reinstall (use if lock file is corrupted)

### Check environment variables

**Web app** (`apps/web/.env.local`):
```bash
cat apps/web/.env.local
# Compare with: apps/web/.env.example
```

**Mobile app** (`apps/expo/.env.local`):
```bash
cat apps/expo/.env.local
# Compare with: apps/expo/.env.example
```

**Backend** (Convex):
```bash
cd packages/backend
npx convex env list
# See packages/backend/.env.example for available variables
```

### Verify versions

```bash
node --version    # Should be 18+
pnpm --version    # Should be 8+
npx convex --version
```

### Common mistakes

1. **Forgot to start Convex**: Always run `npx convex dev` first
2. **Wrong directory**: Make sure you're in the right folder
3. **Environment variables**: Must restart dev server after changing
4. **Not signed in**: Some features require authentication
5. **Old cache**: Clear caches when things don't update

---

## 🆘 Still Stuck?

### Check existing documentation

- [Getting Started Guide](./GETTING_STARTED.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Feature-specific docs](./docs/)

### Check official docs

- **Convex**: <https://docs.convex.dev/>
- **React**: <https://react.dev/>
- **React Native**: <https://reactnative.dev/>
- **Expo**: <https://docs.expo.dev/>
- **Clerk**: <https://clerk.com/docs>

### Debug checklist

Before asking for help, verify:

- [ ] Node.js 18+ installed
- [ ] pnpm installed
- [ ] Dependencies installed (`pnpm install`)
- [ ] Convex running (`npx convex dev`)
- [ ] Environment variables set
- [ ] Signed in to app
- [ ] Checked logs for errors
- [ ] Tried clearing caches
- [ ] Restarted dev servers

### Get help

1. Check error messages carefully
2. Search for the error online
3. Check GitHub issues
4. Ask in Convex Discord: <https://convex.dev/community>

---

**Remember**: Most issues are solved by:
1. Restarting the dev server
2. Clearing caches
3. Checking environment variables
4. Reading error messages carefully

Good luck! 🍀
