# Audio Import Flow Documentation

## Overview

The audio import feature allows users to share audio files from other apps (like Voice Memos, WhatsApp, etc.) directly into Audora for transcription and analysis.

## Architecture

### Components

1. **Mobile App (`apps/expo/app/(tabs)/import.tsx`)**
   - Handles share intent from other apps
   - Provides friend selection UI
   - Uploads audio to Convex storage
   - Displays progress and status updates

2. **Backend (`packages/backend/convex/mobileImport.ts`)**
   - Processes imported audio files
   - Orchestrates transcription and analysis
   - Saves results to database

3. **Existing Services**
   - `speechmaticsBatch.ts` - Batch transcription using Speechmatics API
   - `conversations.ts` - Conversation management
   - `network.ts` - User contacts/network

## Flow Diagram

```
User shares audio → Import Screen → Select Friend → Upload to Convex
                                                           ↓
                                                    Process Audio
                                                           ↓
                                    ┌─────────────────────┴─────────────────────┐
                                    ↓                                           ↓
                          Transcribe with Speechmatics              Analyze with GPT-4
                          (Speaker diarization)                     (Extract facts & summary)
                                    ↓                                           ↓
                                    └─────────────────────┬─────────────────────┘
                                                          ↓
                                                   Save to Database
                                                          ↓
                                                  Show Success Message
```

## Processing Stages

### Stage 1: Friend Selection
- User selects which friend was in the conversation
- Displays all contacts from user's network
- Shows contact name, email, and avatar

### Stage 2: Upload
- Reads audio file from share intent
- Converts to blob
- Uploads to Convex storage
- Progress: 10% → 25%

### Stage 3: Transcription
- Uses Speechmatics Batch API
- Speaker diarization (identifies S1 and S2)
- Generates timestamped transcript
- Progress: 25% → 70%

### Stage 4: Analysis
- GPT-4 analyzes transcript
- Extracts facts for each speaker
- Generates conversation summary
- Progress: 70% → 95%

### Stage 5: Save
- Maps speakers to user IDs
- Saves transcript turns to database
- Saves facts for each participant
- Updates conversation status
- Progress: 95% → 100%

## API Functions

### `mobileImport.processImportedAudio`

**Purpose:** Process a single audio file from mobile app

**Arguments:**
- `storageId` - Convex storage ID of uploaded audio
- `friendId` - User ID of the friend in the conversation
- `location` - Optional location string (defaults to "Imported from Mobile")

**Returns:**
- `conversationId` - ID of created conversation
- `success` - Boolean indicating success

**Flow:**
1. Authenticate user
2. Get friend details
3. Create conversation
4. Link conversation to friend
5. Save audio storage ID
6. Trigger batch transcription (via `speechmaticsBatch.batchTranscribe`)
7. Return conversation ID

### `mobileImport.processImportedAudioInChunks`

**Purpose:** Process large audio files in multiple chunks

**Arguments:**
- `storageIds` - Array of Convex storage IDs (one per chunk)
- `friendId` - User ID of the friend
- `location` - Optional location string

**Returns:**
- `conversationId` - ID of created conversation
- `success` - Boolean indicating success

**Flow:**
1. Create conversation and link to friend
2. Process each chunk individually using `transcribeChunkOnly`
3. Combine all transcripts, facts, and summaries
4. Deduplicate facts
5. Save combined results to database

## Database Schema

### Conversations Table
```typescript
{
  initiatorUserId: Id<"users">,
  scannerUserId?: Id<"users">,
  status: "pending" | "active" | "ended",
  inviteCode: string,
  location?: string,
  startedAt?: number,
  endedAt?: number,
  summary?: string,
  audioStorageId?: Id<"_storage">
}
```

### Transcript Turns Table
```typescript
{
  conversationId: Id<"conversations">,
  userId: Id<"users">,
  text: string,
  order: number
}
```

### Conversation Facts Table
```typescript
{
  conversationId: Id<"conversations">,
  userId: Id<"users">,
  facts: string[]
}
```

## Error Handling

### Common Errors

1. **No Audio File**
   - User shares non-audio file
   - Shows alert and returns to previous screen

2. **Upload Failed**
   - Network error during upload
   - Shows retry option

3. **Transcription Failed**
   - Speechmatics API error
   - Conversation marked as ended
   - Error message shown to user

4. **No Contacts**
   - User has no friends in network
   - Shows message to add contacts first

### Error Recovery

- All errors show user-friendly messages
- Retry option for recoverable errors
- Cancel option to abort import
- Conversation cleanup on failure

## UI States

### Selecting Friend
- Shows list of contacts
- Displays file info (name, size)
- Cancel and Import buttons

### Processing
- Activity indicator
- Status message
- Progress bar (0-100%)
- Stage indicators (Upload → Transcribe → Analyze)
- Helpful hints for long operations

### Complete
- Success alert
- Option to view conversation
- Cleans up share intent

## Performance Considerations

### File Size Limits
- Recommended: < 100MB
- Large files may take several minutes to process
- Consider chunking for files > 50MB

### Processing Time
- Upload: ~5-10 seconds per 10MB
- Transcription: ~1-2 minutes per 10 minutes of audio
- Analysis: ~10-30 seconds

### Optimization Tips
1. Use `processImportedAudioInChunks` for files > 50MB
2. Show progress updates to keep user informed
3. Process in background if possible
4. Cache uploaded audio for retry scenarios

## Testing

### Manual Testing Steps

1. **Share Audio File**
   ```
   - Open Voice Memos or similar app
   - Select an audio recording
   - Tap Share → Audora
   ```

2. **Select Friend**
   ```
   - Verify contacts list loads
   - Select a friend
   - Verify selection highlights
   ```

3. **Monitor Progress**
   ```
   - Verify upload progress shows
   - Verify transcription message appears
   - Verify progress bar updates
   ```

4. **Verify Results**
   ```
   - Check conversation appears in list
   - Verify transcript is accurate
   - Verify facts are extracted
   - Verify summary is generated
   ```

### Edge Cases

- Empty audio file
- Corrupted audio file
- Very long audio (> 1 hour)
- Multiple speakers (> 2)
- Background noise
- Poor audio quality

## Future Enhancements

1. **Chunk Processing**
   - Implement audio splitting in React Native
   - Process large files in parallel chunks

2. **Offline Support**
   - Queue imports for later processing
   - Retry failed uploads automatically

3. **Advanced Analytics**
   - Speech analytics (filler words, pacing)
   - Sentiment analysis
   - Topic extraction

4. **Multi-Speaker Support**
   - Support > 2 speakers
   - Speaker identification by voice

5. **Real-time Progress**
   - WebSocket updates from backend
   - Live transcription preview

## Troubleshooting

### Import Stuck at "Transcribing"
- Check Speechmatics API key is valid
- Verify audio format is supported
- Check backend logs for errors

### No Contacts Showing
- Verify user has conversations with others
- Check network query is working
- Ensure user is authenticated

### Upload Fails
- Check network connection
- Verify Convex deployment is running
- Check file size is within limits

## Related Files

- `/apps/expo/app/(tabs)/import.tsx` - Import screen UI
- `/packages/backend/convex/mobileImport.ts` - Mobile import actions
- `/packages/backend/convex/speechmaticsBatch.ts` - Transcription service
- `/packages/backend/convex/conversations.ts` - Conversation management
- `/packages/backend/convex/network.ts` - Contact management
