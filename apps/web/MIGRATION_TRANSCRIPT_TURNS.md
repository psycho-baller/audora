# TranscriptTurns Migration: Speaker → userId

## Summary
Successfully migrated the `transcriptTurns` table from using `speaker` (string) to `userId` (Id<"users">).

## Changes Made

### 1. Schema Update (`convex/schema.ts`)
- **Changed**: `speaker: v.string()` → `userId: v.id("users")`
- **Added** new indexes:
  - `by_user` - for querying all turns by a specific user
  - `by_conversation_and_user` - for querying a specific user's turns in a conversation

### 2. Migration Script (`convex/migrations.ts`)
Created `migrateTranscriptTurnsToUserId` mutation to safely migrate existing data:
- Converts speaker names or IDs to proper userId references
- Maps S1 to initiator, S2 to scanner
- Handles edge cases (missing conversation, invalid speakers)
- Uses `ctx.db.replace()` to update schema while preserving data

### 3. Backend Updates

#### `convex/analytics.ts`
- Changed filter: `turn.speaker === args.userId` → `turn.userId === args.userId`
- Updated logs to show `userId` instead of speaker name

#### `convex/conversations.ts`
- `saveTranscriptData`: Changed args from `speaker: v.string()` to `userId: v.id("users")`
- `getTranscript`: Updated return type to include `userId` instead of `speaker`
- Insert statement updated to use `userId`

#### `convex/realtimeTranscription.ts`
- Added `speakerToUserIdMap` to convert S1/S2 labels to userIds
- Created `transcriptWithUserIds` for database storage
- Kept `transcript` with speaker names for AI processing
- Fixed to use `ctx.runQuery()` to get conversation data in action context

### 4. Frontend Updates

#### `app/components/recording/CompletedView.tsx`
- Added `getUserName()` helper to convert userId to display name
- Changed state: `selectedSpeaker` → `selectedUserId`
- Updated variable: `speakers` → `userIds`
- Updated all transcript rendering to use `turn.userId` and `getUserName()`
- Changed filter buttons from "All Speakers" to "All Participants"
- Fixed download functionality to use userId

## How to Run Migration

1. **Deploy schema changes**:
   ```bash
   npx convex deploy
   ```

2. **Run the migration** (in Convex dashboard or via CLI):
   ```bash
   npx convex run migrations:migrateTranscriptTurnsToUserId
   ```

3. **Verify migration**:
   - Check logs for migration stats (migrated, skipped, errors)
   - Verify existing conversations still display correctly
   - Create a new conversation and verify it uses userId

## Benefits

1. **Type Safety**: userId is now properly typed as `Id<"users">` instead of string
2. **Consistency**: Matches the pattern used in `conversationFacts` and `speechAnalytics`
3. **Flexibility**: Can easily get user details by joining with users table
4. **Analytics**: Direct reference to userId enables better speech analytics per user
5. **Referential Integrity**: Proper foreign key relationship with users table

## Backward Compatibility

The migration script handles existing data gracefully:
- ✅ Already migrated records are skipped
- ✅ Speaker labels (S1, S2) are mapped to correct userIds
- ✅ Existing userId values are preserved
- ✅ Missing or invalid data is logged and skipped

## Testing Checklist

- [ ] Existing conversations display correctly
- [ ] New conversations save with userId
- [ ] Speech analytics works with userId filtering
- [ ] Download transcript shows user names
- [ ] User filtering in CompletedView works
- [ ] Real-time transcription maps S1/S2 correctly
