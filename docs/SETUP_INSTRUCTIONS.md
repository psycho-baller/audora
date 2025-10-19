# Quick Setup Instructions

## Required Environment Variable

Add this to your `.env.local` file:

```bash
SPEECHMATICS_API_KEY=your_speechmatics_api_key_here
```

Get your API key from: https://portal.speechmatics.com/

## Installation

The required packages are already installed:
```bash
✓ @speechmatics/real-time-client@7.0.2
✓ @speechmatics/auth@0.1.0
```

## Run the App

1. **Start Convex backend:**
   ```bash
   npx convex dev
   ```

2. **Start frontend (in another terminal):**
   ```bash
   bun run dev
   ```

3. **Open browser and test:**
   - Navigate to dashboard
   - Click "Start Recording"
   - Grant microphone permissions
   - **Watch the live transcript appear as you speak!**

## What You'll See

1. Recording starts automatically (for initiator)
2. **Real-time transcript box** appears below the recording circle
3. Text updates **live** as you speak with **speaker labels**: `[S1] Hello there...`
4. **Different speakers** are automatically detected and labeled
5. **Current sentence** shows in blue italic (in-progress)
6. **Completed sentences** show in gray
7. When you stop recording:
   - Audio uploads to Convex
   - Structured transcript with speaker labels processed
   - AI identifies actual speaker names from context
   - Facts extracted per speaker
   - Summary generated

## Key Features

### ✅ Real-Time Transcription
- Live transcript updates as you speak
- Sub-second latency

### ✅ Speaker Diarization
- **Automatic speaker detection** (S1, S2, etc.)
- Speaker labels visible in real-time: `[S1] text...`
- Smart turn merging for same speaker

### ✅ AI-Powered Name Recognition
- GPT-4o identifies actual names from context
- Converts S1/S2 to real names (e.g., "John", "Sarah")
- Falls back to "Speaker 1", "Speaker 2" if names unknown

### ✅ Structured Data
Each turn captured with:
- Speaker ID
- Text content
- Start/end timestamps
- Per-speaker fact extraction

## Troubleshooting

**If transcript doesn't appear:**
1. Check browser console for errors
2. Verify SPEECHMATICS_API_KEY is set correctly
3. Ensure microphone permissions are granted
4. Try speaking louder/clearer

**If speaker labels not showing:**
1. Ensure speaker diarization is enabled (it is by default)
2. Check console logs for "S1", "S2" labels in transcript events
3. Try having distinct voices speak

**If you see "Cannot find api.speechmatics":**
- Make sure `npx convex dev` is running
- It auto-generates the types from `convex/speechmatics.ts` and `convex/realtimeTranscription.ts`

## Architecture Summary

```
Your Voice
    ↓
Microphone → AudioContext → Speechmatics Real-Time API
          ↘                        ↓
           MediaRecorder     Speaker-Labeled Transcript
                ↓                   ↓
           Convex Storage    Structured Turns (S1, S2)
                                    ↓
                              AI Processing (GPT-4o)
                                    ↓
                              Named Speakers + Facts
                                    ↓
                              Convex Database + Zep Graph
```

### Data Flow
1. **Audio streams** to both MediaRecorder (storage) and Speechmatics (transcription)
2. **Speechmatics** returns real-time transcript with speaker labels (S1, S2)
3. **Frontend** collects structured turns with speaker, text, timestamps
4. **When recording stops:**
   - Audio saved to Convex storage
   - Structured transcript sent to backend
   - GPT-4o identifies real names and extracts facts
   - Data saved to Convex database
   - Entities/relationships added to Zep knowledge graph

## Documentation

- **`SPEECHMATICS_INTEGRATION.md`** - Technical implementation details
- **`SPEAKER_DIARIZATION.md`** - Speaker detection features and configuration
- **`README.md`** - Project overview
