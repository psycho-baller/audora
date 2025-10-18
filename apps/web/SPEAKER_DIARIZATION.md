# Speaker Diarization with Speechmatics

## Overview

The app now uses **Speechmatics speaker diarization** to automatically identify and separate different speakers in real-time during recording. This eliminates the need for manual speaker identification and provides accurate speaker labels throughout the conversation.

## Key Features

### 1. **Real-Time Speaker Detection**
- Speechmatics identifies speakers as they speak (S1, S2, etc.)
- Speaker labels appear in the live transcript: `[S1] Hello there`
- Different speakers are automatically separated

### 2. **Structured Transcript Collection**
Each conversation turn is captured with:
- **Speaker ID**: Who spoke (S1, S2)
- **Text**: What they said
- **Start Time**: When they started speaking (seconds)
- **End Time**: When they stopped speaking (seconds)

### 3. **Smart Turn Merging**
- Consecutive utterances from same speaker are merged
- Merges if gap < 2 seconds between turns
- Creates natural conversation flow

### 4. **AI Speaker Name Identification**
- GPT-4o analyzes transcript to identify actual names
- Converts "S1", "S2" labels to real names when possible
- Uses context clues (e.g., "Hi, I'm John")
- Falls back to "Speaker 1", "Speaker 2" if names unknown

## Configuration

### Speechmatics Setup

```typescript
transcription_config: {
  language: "en",
  operating_point: "enhanced",
  diarization: "speaker",              // ✅ Enable speaker diarization
  speaker_diarization_config: {
    max_speakers: 2,                   // Expecting 2 speakers
  },
  transcript_filtering_config: {
    remove_disfluencies: true,
  },
}
```

### Key Config Options

- **`diarization: "speaker"`** - Enables speaker separation
- **`max_speakers: 2`** - Optimizes for 2-person conversations (can increase if needed)
- **`enable_partials: true`** - Shows partial results before sentence completion

## Data Flow

```
Microphone Audio
    ↓
Speechmatics Real-Time API
    ↓
AddTranscript Events with Speaker Labels
    ↓
{
  results: [
    {
      type: "word",
      alternatives: [{ content: "Hello", speaker: "S1" }],
      start_time: 0.5,
      end_time: 0.8,
      is_eos: false
    },
    ...
  ]
}
    ↓
Structured Transcript Turns
    ↓
[
  {
    speaker: "S1",
    text: "Hello there, how are you?",
    startTime: 0.5,
    endTime: 2.3
  },
  {
    speaker: "S2",
    text: "I'm doing great, thanks!",
    startTime: 2.5,
    endTime: 4.1
  }
]
    ↓
AI Processing (GPT-4o)
    ↓
{
  transcript: [
    { speaker: "John", text: "Hello there, how are you?" },
    { speaker: "Sarah", text: "I'm doing great, thanks!" }
  ],
  facts: {
    "John": ["..."],
    "Sarah": ["..."]
  },
  summary: "..."
}
```

## Implementation Details

### Frontend (`CurrentView.tsx`)

#### Real-Time Processing
```typescript
// Collect speaker-labeled transcript turns
const transcriptTurnsRef = useRef<TranscriptTurn[]>([]);

// Process AddTranscript events
if (data.message === "AddTranscript") {
  for (const result of data.results) {
    const speaker = result.alternatives?.[0]?.speaker || "Unknown";
    const startTime = result.start_time;
    const endTime = result.end_time;
    
    // Build sentence with speaker label
    if (result.is_eos) {
      // Save complete turn
      transcriptTurnsRef.current.push({
        speaker,
        text: completeSentence,
        startTime,
        endTime,
      });
    }
  }
}
```

#### Recording End
```typescript
// When user stops recording
recorder.onstop = async () => {
  // Get structured transcript with speakers
  const structuredTranscript = transcriptTurnsRef.current;
  
  // Process with AI
  const result = await processRealtimeTranscript({
    conversationId,
    transcriptTurns: structuredTranscript,
    userEmail,
    userName,
  });
};
```

### Backend (`convex/realtimeTranscription.ts`)

#### Process Structured Transcript
```typescript
export const processRealtimeTranscript = action({
  args: {
    conversationId: v.id("conversations"),
    transcriptTurns: v.array(
      v.object({
        speaker: v.string(),      // "S1", "S2", etc.
        text: v.string(),
        startTime: v.number(),
        endTime: v.number(),
      })
    ),
    userEmail: v.optional(v.string()),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Format for AI
    const formatted = args.transcriptTurns.map(turn =>
      `[${turn.startTime.toFixed(2)}-${turn.endTime.toFixed(2)}] ${turn.speaker}: ${turn.text}`
    ).join("\n");
    
    // AI identifies actual names and extracts facts
    const result = await generateObject({
      model: openaiProvider("gpt-4o"),
      schema: z.object({
        transcript: z.array(...),  // With real names
        facts: z.record(...),      // Per speaker
        summary: z.string(),
      }),
      prompt: `Identify speaker names from context...`
    });
    
    // Save to database
    await ctx.runMutation(api.conversations.saveTranscriptData, {
      conversationId,
      transcript: result.transcript,
      facts: result.facts,
      summary: result.summary,
    });
  }
});
```

## UI Display

### Live Transcript
```tsx
{isRecording && (realtimeTranscript || currentSentence) && (
  <div className="bg-[#353E41] rounded-2xl p-4">
    <h3>Live Transcript</h3>
    
    {/* Completed sentences */}
    {realtimeTranscript && (
      <p className="text-gray-200">{realtimeTranscript}</p>
    )}
    
    {/* Current sentence with speaker label */}
    {currentSentence && (
      <p className="text-blue-300 italic">
        {currentSentence}...  {/* Shows: [S1] Hello there... */}
      </p>
    )}
  </div>
)}
```

## Benefits

### Before (No Diarization)
❌ Single stream of text, no speaker separation  
❌ Manual speaker identification required  
❌ AI must guess who said what  
❌ Less accurate fact extraction  

### After (With Diarization)
✅ **Automatic speaker separation** in real-time  
✅ **Accurate speaker labels** for each utterance  
✅ **AI identifies real names** from context  
✅ **Per-speaker fact extraction**  
✅ **Better conversation structure**  
✅ **Zep knowledge graph** organized by person  

## Speechmatics Pricing

Speaker diarization is included in the real-time transcription service at no extra cost. You pay per minute of audio transcribed.

- **Enhanced model**: Higher cost but better accuracy
- **Diarization**: Included
- **Max speakers**: No additional cost for 2-10 speakers

Check current pricing: https://www.speechmatics.com/pricing

## Testing Speaker Diarization

### Test Scenario 1: Two People Introducing Themselves
```
User 1: "Hi, I'm John. Nice to meet you."
User 2: "Hello John, I'm Sarah. How are you?"
John: "I'm doing great! I work at Google."
Sarah: "That's awesome! I'm at Microsoft."
```

**Expected Output:**
```json
{
  "transcript": [
    { "speaker": "John", "text": "Hi, I'm John. Nice to meet you." },
    { "speaker": "Sarah", "text": "Hello John, I'm Sarah. How are you?" },
    { "speaker": "John", "text": "I'm doing great! I work at Google." },
    { "speaker": "Sarah", "text": "That's awesome! I'm at Microsoft." }
  ],
  "facts": {
    "John": ["Works at Google"],
    "Sarah": ["Works at Microsoft"]
  }
}
```

### Test Scenario 2: Name Inference
```
User 1: "Hey there!"
User 2: "Hi! What's your name?"
User 1: "I'm Alex, and you?"
User 2: "I'm Taylor."
```

**Expected Output:**
- S1 identified as "Alex"
- S2 identified as "Taylor"
- AI correctly maps early utterances to identified names

## Troubleshooting

### Issue: All Text Labeled as Same Speaker

**Possible Causes:**
1. Only one person speaking
2. Background noise confusing diarization
3. Speakers too similar (rare)

**Solutions:**
- Ensure both people speak clearly
- Reduce background noise
- Test with distinct voices

### Issue: Speaker Labels Not Appearing in UI

**Check:**
1. `diarization: "speaker"` enabled in config
2. `result.alternatives?.[0]?.speaker` being read correctly
3. Console logs show speaker labels in AddTranscript events

### Issue: AI Can't Identify Real Names

**Expected Behavior:**
- If names not mentioned in conversation, AI uses "Speaker 1", "Speaker 2"
- This is correct - AI should not guess/make up names

**Encourage:**
- Users to introduce themselves at start
- Natural conversation with names

## Advanced Configuration

### More Than 2 Speakers

```typescript
speaker_diarization_config: {
  max_speakers: 4,  // For group conversations
}
```

### Language-Specific Diarization

```typescript
transcription_config: {
  language: "es",  // Spanish
  diarization: "speaker",
  // Diarization works across 30+ languages
}
```

## Future Enhancements

1. **Voice Profiles** - Save voice signatures for automatic name recognition
2. **Visual Speaker Indicators** - Different colors per speaker in UI
3. **Speaker Analytics** - Talk time, interruptions, sentiment per speaker
4. **Multi-party Support** - Handle 3+ speakers in group conversations
5. **Custom Speaker Labels** - Let users assign names during recording

## Resources

- [Speechmatics Diarization Docs](https://docs.speechmatics.com/features/speaker-diarization)
- [Real-time API Reference](https://docs.speechmatics.com/rt-api-ref)
- [Best Practices](https://docs.speechmatics.com/features/best-practices)
