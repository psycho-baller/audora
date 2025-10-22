# 📱 Quick Start: Mobile App

This guide will help you run just the mobile application.

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- Convex account (free at <https://convex.dev>)
- Clerk account (free at <https://clerk.com>)

### For iOS Development (Optional)

- Mac computer
- Xcode installed
- Expo Go or an iOS simulator with a build of the app

### For Android Development (Optional)

- Android Studio installed
- Expo Go or an Android emulator with a build of the app

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

## Step 4: Configure Environment Variables

Copy the example file and fill in your values:

```bash
# From the root of the project
cp apps/expo/.env.example apps/expo/.env.local
```

Then edit `apps/expo/.env.local` with your actual values:

```env
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
```

**Important**: Mobile apps use `EXPO_PUBLIC_` prefix for environment variables.

## Step 5: Connect Clerk to Convex

1. In Clerk dashboard → **JWT Templates** → **New Template** → **Convex**
2. Copy the **JWKS Endpoint URL**
3. In Convex dashboard → **Settings** → **Authentication** → **Add Provider**
4. Select **Clerk** and paste the JWKS URL

## Step 6: Run the Mobile App

Open a new terminal (keep Convex running in the other):

```bash
# From the root of the project
pnpm dev:expo
```

You'll see a QR code in the terminal.

## Step 7: Open on Your Phone

### Option 1: Expo Go (Easiest)

1. Open **Expo Go** app on your phone
2. Scan the QR code with:
   - **iOS**: Camera app
   - **Android**: Expo Go app
3. App will load on your phone

**Note**: Make sure your phone and computer are on the same WiFi network.

### Option 2: iOS Simulator (Mac only)

```bash
# In the Expo terminal, press 'i'
# Or run:
pnpm --filter @audora/expo ios
```

### Option 3: Android Emulator

```bash
# Make sure emulator is running first
# In the Expo terminal, press 'a'
# Or run:
pnpm --filter @audora/expo android
```

## What You Can Do Now

### Without API Keys

- Sign up / Sign in
- View the UI
- Navigate between screens

### With OpenAI API Key

Set in Convex environment:

```bash
cd packages/backend
npx convex env set OPENAI_API_KEY "sk-xxxxx"
```

**Note**: See `packages/backend/.env.example` for all available backend environment variables.

Now you can:

- Record conversations
- Import audio files
- Get AI-powered transcriptions
- See speech analytics

### With Speechmatics API Key

Add to Convex:

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
# Start mobile app
pnpm dev:expo

# Start with tunnel (if QR code doesn't work)
pnpm dev:expo
# Then press 's' → select 'tunnel'

# Clear cache and restart
cd apps/expo
rm -rf .expo
pnpm dev

# Build for iOS
pnpm --filter @audora/expo ios

# Build for Android
pnpm --filter @audora/expo android
```

## Troubleshooting

### QR Code Not Working

**Solution 1**: Use tunnel mode

```bash
pnpm dev:expo
# Press 's' → select 'tunnel'
```

**Solution 2**: Check WiFi

- Make sure phone and computer are on same network
- Try disabling VPN

**Solution 3**: Use simulator/emulator instead

### "Unable to resolve module"

```bash
cd apps/expo

# Clear cache
rm -rf .expo
rm -rf node_modules/.cache

# Reinstall
pnpm install

# Restart
pnpm dev
```

### App Crashes on Startup

1. Check Expo terminal for errors
2. Verify `.env.local` exists and has correct values
3. Make sure Convex is running
4. Try clearing cache: `rm -rf .expo`

### iOS Simulator Not Opening

1. Make sure Xcode is installed
2. Open Xcode → Preferences → Locations → Command Line Tools (select version)
3. Open simulator manually: `open -a Simulator`
4. Then press `i` in Expo terminal

### Android Emulator Not Opening

1. Make sure Android Studio is installed
2. Open Android Studio → AVD Manager
3. Start an emulator manually
4. Then press `a` in Expo terminal

### Changes Not Appearing

1. Shake device → Reload
2. Or press `r` in Expo terminal
3. Or clear cache: `rm -rf .expo && pnpm dev`

## Development Tips

### Hot Reload

Changes to your code automatically reload the app. If not:

- Shake device → Enable Fast Refresh
- Or press `r` in terminal to reload manually

### Debug Menu

- **iOS**: Cmd+D in simulator, or shake device
- **Android**: Cmd+M in emulator, or shake device

Options:

- Reload
- Debug Remote JS
- Show Performance Monitor
- Show Element Inspector

### View Logs

Logs appear in the Expo terminal. For more details:

- Press `j` to open debugger in browser
- Use `console.log()` in your code

### Test on Real Device

Testing on a real device is recommended for:

- Camera/microphone features
- Performance testing
- Touch gestures
- Real-world conditions

## Project Structure

```
apps/expo/
├── app/                    # App screens (file-based routing)
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── index.tsx      # Home screen
│   │   ├── record.tsx     # Recording screen
│   │   └── import.tsx     # Import screen
│   ├── (auth)/            # Auth screens
│   └── _layout.tsx        # Root layout
├── components/            # Reusable components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities
└── .env.local            # Environment variables
```

## Next Steps

- Read [Architecture Overview](./ARCHITECTURE.md) to understand how it works
- Explore the code in `apps/expo/app/`
- Check [Troubleshooting Guide](./TROUBLESHOOTING.md) for common issues
- Try modifying a screen or adding a new component

## Building for Production

### iOS (requires Mac + Apple Developer account)

```bash
cd apps/expo

# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure
eas build:configure

# Build
eas build --platform ios --local --profile preview
```

### Android

```bash
cd apps/expo

# Build
eas build --platform android --local --profile preview
```

See [Expo EAS Build docs](https://docs.expo.dev/build/introduction/) for more details.
