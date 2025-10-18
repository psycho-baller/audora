# Bug Fix: Duplicate Transcript Turns

## Issue
Transcript turns were being saved twice, causing duplicate entries in the database and UI.

## Root Cause
In `app/components/recording/CurrentView.tsx`, the `processRealtimeTranscript` action was being called **twice**:

1. **First call (line 339)**: Process the real-time transcript from Speechmatics
2. **Second call (line 364)**: Originally intended to process a more accurate batch transcript

The problem: The batch transcription code was commented out, but the second call to `processRealtimeTranscript` was still active, processing the **same** `structuredTranscript` again.

```typescript
// ❌ WRONG: Called processRealtimeTranscript twice with same data
const result = await processRealtimeTranscript({
  conversationId,
  transcriptTurns: structuredTranscript,
  // ...
});

// Later...
const batchTranscriptWithNames = await processRealtimeTranscript({
  conversationId,
  transcriptTurns: structuredTranscript, // ❌ Same data again!
  // ...
});
```

Each call would insert all transcript turns again, resulting in duplicates.

## Fix Applied

### 1. Removed Duplicate Call (`app/components/recording/CurrentView.tsx`)

Commented out the entire second `processRealtimeTranscript` call block since:
- Batch transcription is currently disabled
- It was using the same data source anyway

Added a note for future development:
```typescript
// Batch transcription disabled for now
// If enabled in future, ensure it uses different transcript data to avoid duplicates
// ... (commented code with fix note)
```

**Key change**: If batch transcription is re-enabled, it must use `batchResult.transcript` instead of `structuredTranscript`.

### 2. Created Cleanup Migration (`convex/migrations.ts`)

Added `removeDuplicateTranscriptTurns` mutation to clean up existing duplicates:
- Identifies duplicate turns by matching `order + userId + text`
- Keeps the first occurrence, deletes duplicates
- Logs progress for each conversation

## Files Modified

1. **`app/components/recording/CurrentView.tsx`** - Removed duplicate processing call
2. **`convex/migrations.ts`** - Added cleanup migration

## Testing Steps

### Deploy the Fix:
```bash
npx convex dev --once
```

### Clean Up Existing Duplicates:
```bash
npx convex run migrations:removeDuplicateTranscriptTurns
```

Expected output:
```
Found X conversations to check for duplicates
Conversation xxx: Deleting Y duplicate turns out of Z total
Migration complete: Fixed N conversations, deleted M duplicate turns
```

### Verify:
1. Check existing conversations - duplicates should be removed
2. Complete a new recording - transcript should appear only once
3. Check database: Each turn should have a unique `order` value per conversation

## Prevention

- ✅ Only one call to `processRealtimeTranscript` per recording
- ✅ Clear comments about future batch transcription implementation
- ✅ Migration available to clean up any existing issues

## Impact

**Before Fix**:
- Transcript turns saved twice
- UI showed duplicate messages
- Confusing user experience
- Database bloat

**After Fix**:
- ✅ Transcripts saved once
- ✅ Clean UI display
- ✅ Efficient database usage
- ✅ Existing duplicates cleaned up
