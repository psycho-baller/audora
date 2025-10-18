# Speechmatics Real-Time Transcription Integration

## Overview

This integration uses **Speechmatics real-time transcription** to provide live transcript updates during audio recording. The transcript appears in real-time in the UI, and when recording ends, the final transcript is saved to Convex along with the audio file.

## Architecture

### 1. **Client-Side (Browser)**
- `RealtimeClient` from `@speechmatics/real-time-client` handles WebSocket connection to Speechmatics
- `MediaRecorder` captures audio chunks for storage
- `AudioContext` with `ScriptProcessor` streams audio to Speechmatics in real-time
- React state manages live transcript display

### 2. **Server-Side (Convex)**
- `convex/speechmatics.ts` - Action to generate JWT tokens (keeps API key secure)
- `convex/transcription.ts` - Existing action for post-processing with AI
- Audio stored in Convex storage for archival

### 3. **Data Flow**

```
User speaks → Microphone
              ↓
              ├─→ MediaRecorder (stores chunks) → Convex Storage
              └─→ AudioContext → ScriptProcessor → Speechmatics API
                                                     ↓
                                                   WebSocket
                                                     ↓
                                                  Real-time transcript
                                                     ↓
                                                  UI updates (React state)
                                                     ↓
                                          Recording ends → Final transcript → Convex DB
```

## Key Components

### `convex/speechmatics.ts`
Generates JWT tokens for Speechmatics authentication:
```typescript
export const generateJWT = action({
  handler: async () => {
    const jwt = await createSpeechmaticsJWT({
      type: "rt",
      apiKey: process.env.SPEECHMATICS_API_KEY,
      ttl: 3600, // 1 hour
    });
    return jwt;
  },
});
```

### `CurrentView.tsx` - Real-time Transcription

#### Initialization
- Creates `RealtimeClient` instance
- Sets up event listeners for transcript updates
- Gets JWT from Convex action (secure)
- Starts Speechmatics session with config

#### Audio Streaming
- `AudioContext` with 16kHz sample rate
- `ScriptProcessor` converts Float32 to Int16 PCM
- Streams audio chunks to Speechmatics via WebSocket

#### Transcript Updates
- `AddTranscript` messages received from Speechmatics
- Words and punctuation accumulated into sentences
- Live updates shown in UI with:
  - **Completed sentences** (gray text)
  - **Current sentence** (blue italic - in progress)

#### Recording End
- Stops Speechmatics session
- Uploads audio blob to Convex storage
- Saves final transcript to database
- Processes with existing AI pipeline

## Configuration

### Environment Variables

Add to your `.env.local`:
```bash
SPEECHMATICS_API_KEY=your_api_key_here
```

Get your API key from: https://portal.speechmatics.com/

### Speechmatics Config

Current settings in `CurrentView.tsx`:
```typescript
transcription_config: {
  language: "en",
  operating_point: "enhanced",  // Higher accuracy
  max_delay: 1.0,               // 1 second max delay
  enable_partials: true,        // Show partial results
  transcript_filtering_config: {
    remove_disfluencies: true,  // Remove "um", "uh", etc.
  },
}
```

## UI Features

### Live Transcript Display
- Appears only while recording
- Auto-scrolls to show latest text
- Max height with overflow scroll
- Visual distinction:
  - Completed text: light gray
  - In-progress: blue italic with "..."

### States
- **Loading**: Getting JWT, starting session
- **Recording**: Live transcript updates
- **Processing**: Saving to Convex, AI processing
- **Complete**: Shows summary and results

## Benefits Over Previous Implementation

### Before (OpenAI Whisper only)
- ❌ No live feedback during recording
- ❌ User doesn't know if audio is being captured correctly
- ❌ Long wait after recording ends
- ✅ Works completely offline (audio uploaded once)

### Now (Speechmatics Real-time)
- ✅ **Live transcript** as user speaks
- ✅ **Immediate feedback** - user knows audio is captured
- ✅ **Better UX** - engaging, responsive
- ✅ **Enhanced accuracy** with operating_point: "enhanced"
- ✅ **Disfluency removal** built-in
- ✅ **Still stores audio** for archival/re-processing
- ⚠️ Requires active internet during recording

## Costs & Considerations

### Speechmatics Pricing
- Real-time transcription charged per minute
- "Enhanced" model costs more but provides better accuracy
- Check current pricing: https://www.speechmatics.com/pricing

### Fallback Strategy
The audio is still stored in Convex, so you can:
1. Use Speechmatics real-time for live UX
2. If Speechmatics fails, fall back to OpenAI Whisper
3. Re-process stored audio later if needed

## Troubleshooting

### Common Issues

1. **"Cannot find api.speechmatics"**
   - Run `npx convex dev` to regenerate types
   - The `speechmatics.ts` file must be in `convex/` folder

2. **"Error starting recording"**
   - Check SPEECHMATICS_API_KEY is set
   - Verify microphone permissions granted
   - Check browser console for WebSocket errors

3. **No transcript appearing**
   - Open browser DevTools → Network → WS tab
   - Verify WebSocket connection established
   - Check for "AddTranscript" messages
   - Ensure audio is actually being sent (check sendAudio calls)

4. **Deprecated ScriptProcessor warning**
   - `createScriptProcessor` is deprecated
   - Future: migrate to AudioWorklet
   - Current implementation works but shows warning

## Future Improvements

1. **AudioWorklet Migration**
   - Replace ScriptProcessor with AudioWorklet for better performance
   - No deprecation warnings

2. **Speaker Diarization**
   - Speechmatics supports speaker separation
   - Add to config: `diarization: "speaker"`
   - Show "Speaker 1:", "Speaker 2:" in transcript

3. **Language Detection**
   - Auto-detect language instead of hardcoding "en"
   - Speechmatics supports 30+ languages

4. **Custom Vocabulary**
   - Add domain-specific terms for better accuracy
   - Useful for technical conversations

5. **Punctuation Timing**
   - Store timestamps with each sentence
   - Enable playback sync with audio later

## Testing

To test the integration:

1. Set SPEECHMATICS_API_KEY in `.env.local`
2. Start Convex: `npx convex dev`
3. Start frontend: `bun run dev`
4. Navigate to recording page
5. Grant microphone permissions
6. Speak clearly and watch live transcript appear
7. Stop recording and verify:
   - Audio uploaded to storage
   - Transcript saved to database
   - AI processing completes

## Resources

- [Speechmatics Docs](https://docs.speechmatics.com/)
- [Real-time Client SDK](https://github.com/speechmatics/speechmatics-js-sdk)
- [Convex Actions](https://docs.convex.dev/functions/actions)
