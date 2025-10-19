# Privacy-First Recording Platform - Setup Guide

This guide will help you set up and run the privacy-first conversation recording platform built with Convex and React.


This platform allows users to:
1. Start a conversation recording
2. Share a QR code for the other participant to scan
3. Both users consent by signing in via QR scan
4. Record the conversation with privacy-first approach
5. Process transcript with AI (Whisper + OpenAI structured output via Vercel AI SDK)
6. Build a knowledge graph in Zep with extracted entities

## Prerequisites

- Node.js 18+ installed
{{ ... }}
- npm or bun package manager
- Clerk account for authentication
- Convex account for backend
- OpenAI API key (for Whisper transcription and structured output)
- Zep API key (for knowledge graph)

## Installation Steps

### 1. Install Dependencies

```bash
cd mru-2025
npm install
# or
bun install
```

### 2. Set Up Clerk Authentication

1. Go to [clerk.com](https://clerk.com) and create an account
2. Create a new application
3. Get your Clerk Publishable Key and Secret Key
4. Note: The app is already configured to use Clerk in `convex/auth.config.ts`

### 3. Set Up Convex

```bash
# Install Convex CLI globally if you haven't
npm install -g convex

# Login to Convex
npx convex login

# Initialize Convex (if not already done)
npx convex dev
```

This will:
- Create a Convex project
- Generate the schema
- Start the development server

### 4. Configure Environment Variables

#### For Convex (Backend):

Set these in your Convex dashboard or via CLI:

```bash
npx convex env set OPENAI_API_KEY "your-openai-api-key"
npx convex env set ZEP_API_KEY "your-zep-api-key"
npx convex env set ZEP_GRAPH_ID "all_users_htn"
```

#### For React App (Frontend):

Create a `.env.local` file in the root directory:

```env
# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# Optional
VITE_TWILIO_PHONE_NUMBER=your_twilio_number
```

### 5. Deploy Convex Functions

```bash
# This pushes your schema and functions to Convex
npx convex deploy
```

## Running the Application

### Development Mode

```bash
# Terminal 1: Run Convex dev server
npx convex dev

# Terminal 2: Run React app
npm run dev
# or
bun dev
```

The app will be available at `http://localhost:5173` (or the port shown in terminal).

## Architecture

### Backend (Convex)

**Schema Tables:**
- `users` - User accounts with Clerk integration
- `conversations` - Conversation records with status workflow
- `transcriptTurns` - Individual transcript entries
- `conversationFacts` - Extracted facts per speaker

**Key Functions:**
- `conversations.create` - Start new conversation
- `conversations.claimScanner` - Join via QR code
- `conversations.saveTranscriptData` - Save processed results
- `transcription.transcribeAudio` - Main AI processing action

**AI Pipeline:**
1. Upload audio to Convex storage
2. Transcribe with OpenAI Whisper
3. Process with OpenAI structured output (via Vercel AI SDK) for speaker identification & facts
4. Extract entities and build Zep knowledge graph
5. Save to Convex database

### Frontend (React)

**Routes:**
- `/record` - Main page with conversation history
- `/record/:id` - Active conversation page
- `/join/:id` - QR code join/consent page

**Components:**
- `PendingView` - Shows QR code while waiting for second user
- `CurrentView` - Active recording interface
- `CompletedView` - Shows transcript and facts after recording

## Usage Flow

### For Initiator:

1. Navigate to `/record`
2. Click "Start Recording"
3. Show QR code to conversation partner
4. Wait for partner to scan and sign in
5. Recording begins automatically when both users are present
6. Click stop button when conversation ends
7. View processed transcript, facts, and summary

### For Scanner:

1. Scan QR code shown by initiator
2. Sign in or sign up via Clerk
3. Consent is recorded automatically
4. Redirected to active conversation
5. Recording begins
6. View completed transcript when finished

## API Keys Setup

### OpenAI API Key
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create API key
3. Ensure you have credits for Whisper API and GPT-4 API

### Zep API Key
1. Go to [getzep.com](https://www.getzep.com)
2. Create account and get API key
3. Note your graph ID (or use default: "all_users_htn")

## Troubleshooting

### TypeScript Errors

After making changes, regenerate Convex types:
```bash
npx convex dev
```

### Missing Dependencies

If you see import errors, install:
```bash
npm install openai qrcode.react zod
```

### Zep API Errors

Ensure your Zep API key is set correctly:
```bash
npx convex env get ZEP_API_KEY
```

### Clerk Authentication Issues

1. Verify VITE_CLERK_PUBLISHABLE_KEY in `.env.local`
2. Check that your Clerk domain is configured in `convex/auth.config.ts`
3. Ensure your Convex deployment URL is added to Clerk's allowed origins

## Production Deployment

### Deploy Convex

```bash
npx convex deploy --prod
```

### Deploy Frontend

The app is configured for Vercel deployment:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Or connect your GitHub repo to Vercel for automatic deployments.

### Environment Variables for Production

Set the same environment variables in your production:
- Convex: Use Convex dashboard or `npx convex env set --prod`
- Vercel: Add in Vercel project settings

## Features

✅ **Privacy-First**: No recording saved without mutual consent  
✅ **QR Code Consent**: Easy participant onboarding  
✅ **AI Processing**: Automatic speaker identification and fact extraction  
✅ **Knowledge Graph**: Builds relationships in Zep  
✅ **Real-time**: Live updates using Convex reactive queries  
✅ **Modern UI**: Beautiful interface with Tailwind CSS  

## Support

For issues or questions:
1. Check Convex logs: `npx convex logs`
2. Review browser console for frontend errors
3. Verify all API keys are set correctly

## License

[Your License Here]
