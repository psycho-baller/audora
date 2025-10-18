# Batch Transcribe Update

## Overview
Updated the `batchTranscribe` function in `speechmaticsBatch.ts` to match the same input/output format and database update patterns as `realtimeTranscription.ts`. This ensures consistency across both transcription methods.

## Changes Made

### 1. Updated Function Signature

**File**: `convex/speechmaticsBatch.ts`

#### Before (Old Arguments)
```typescript
args: {
  storageId: v.id("_storage"),
  conversationId: v.id("conversations"),
  initiatorUserName: v.string(),
  scannerUserName: v.string(),
}
```

#### After (New Arguments - Matches `realtimeTranscription.ts`)
```typescript
args: {
  storageId: v.id("_storage"),
  conversationId: v.id("conversations"),
  initiatorName: v.optional(v.string()),
  scannerName: v.optional(v.string()),
  userEmail: v.optional(v.string()),
  userName: v.optional(v.string()),
}
```

**Changes:**
- ✅ Renamed `initiatorUserName` → `initiatorName`
- ✅ Renamed `scannerUserName` → `scannerName`
- ✅ Made both speaker names optional
- ✅ Added `userEmail` and `userName` for Zep integration

### 2. Updated Return Type

#### Before (Old Return)
```typescript
returns: v.object({
  transcript: v.array(
    v.object({
      speaker: v.string(),
      text: v.string(),
      startTime: v.number(),
      endTime: v.number(),
    })
  ),
  metadata: v.any(),
})
```

#### After (New Return - Matches `realtimeTranscription.ts`)
```typescript
returns: v.object({
  transcript: v.array(v.object({ speaker: v.string(), text: v.string() })),
  S1_facts: v.array(v.string()),
  S2_facts: v.array(v.string()),
  summary: v.string(),
})
```

**Changes:**
- ✅ Simplified transcript format (removed `startTime` and `endTime` from return)
- ✅ Added `S1_facts` array (facts for initiator)
- ✅ Added `S2_facts` array (facts for scanner)
- ✅ Added `summary` string
- ✅ Removed `metadata` object

### 3. Added Complete Processing Pipeline

The updated function now follows the same 9-step process as `realtimeTranscription.ts`:

**Step 1: Get Audio File**
```typescript
const audioBlob = await ctx.storage.get(args.storageId);
```

**Step 2: Transcribe with Speechmatics**
```typescript
const response = await client.transcribe(file, config, "json-v2");
const transcriptTurns = processTranscriptResponse(response);
```

**Step 3: Get Conversation Details**
```typescript
const conversation = await ctx.runQuery(api.conversations.get, {
  id: args.conversationId,
});
```

**Step 4: Map Speakers to User IDs**
```typescript
const speakerToUserIdMap: Record<string, Id<"users">> = {
  S1: conversation.initiatorUserId,
  S2: conversation.scannerUserId || conversation.initiatorUserId,
};
```

**Step 5: Convert Transcript with User IDs**
```typescript
const transcriptWithUserIds = transcriptTurns.map(turn => ({
  speaker: turn.speaker,
  userId: speakerToUserIdMap[turn.speaker],
  text: turn.text,
}));
```

**Step 6: Format Transcript for AI**
```typescript
const formattedTranscript = transcriptTurns
  .map(turn => `${speakerMap[turn.speaker]}: ${turn.text}`)
  .join("\n");
```

**Step 7: AI Analysis for Facts & Summary**
```typescript
const { object: aiAnalysis } = await generateObject({
  model: openaiProvider("gpt-4o"),
  schema: z.object({
    S1_facts: z.array(z.string()),
    S2_facts: z.array(z.string()),
    summary: z.string(),
  }),
  prompt: `Extract facts and generate summary...`,
});
```

**Step 8: Process with Zep (Knowledge Graph)**
```typescript
await processWithZep({
  transcript, 
  facts: aiAnalysis.S1_facts, 
  summary: aiAnalysis.summary 
}, ...);
```

**Step 9: Save to Database**
```typescript
await ctx.runMutation(api.conversations.saveTranscriptData, {
  conversationId: args.conversationId,
  transcript: transcriptWithUserIds,
  S1_facts: aiAnalysis.S1_facts,
  S2_facts: aiAnalysis.S2_facts,
  initiatorName: args.initiatorName,
  scannerName: args.scannerName,
  summary: aiAnalysis.summary,
});
```

### 4. Added Zep Integration Functions

Added all helper functions from `realtimeTranscription.ts`:

- `processWithZep()` - Main Zep processing coordinator
- `createUserEntity()` - Creates user nodes in knowledge graph
- `extractAndStoreEntities()` - Extracts entities from facts (Goals, Languages, Organizations, Topics, Traits)
- `createFriendshipRelationships()` - Creates FRIENDS_WITH relationships
- `storeConversationSummary()` - Stores conversation summaries and participation

### 5. Added Required Imports

```typescript
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { openai as openaiProvider } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { ZepClient } from "@getzep/zep-cloud";

const zepClient = new ZepClient({
  apiKey: process.env.ZEP_API_KEY || "",
});

const GRAPH_ID = process.env.ZEP_GRAPH_ID || "all_users_htn";
```

### 6. Updated Import Page

**File**: `app/routes/dashboard/import.tsx`

#### Added User Context
```typescript
import { useUser } from "@clerk/react-router";

const { user: clerkUser } = useUser();
const selectedContact = contacts.find(c => c.contactId === selectedFriend);
```

#### Updated Function Call
```typescript
await batchTranscribe({
  storageId: storageId as Id<"_storage">,
  conversationId: conversation.id,
  initiatorName: clerkUser?.fullName || clerkUser?.firstName || "You",
  scannerName: selectedContact?.name || "Friend",
  userEmail: clerkUser?.primaryEmailAddress?.emailAddress || undefined,
  userName: clerkUser?.fullName || clerkUser?.firstName || undefined,
});
```

## Benefits

### 1. Consistency
- ✅ Both `batchTranscribe` and `processRealtimeTranscript` now have identical interfaces
- ✅ Same input parameters
- ✅ Same return types
- ✅ Same database update patterns

### 2. Feature Parity
- ✅ AI-powered fact extraction
- ✅ Conversation summary generation
- ✅ Zep knowledge graph integration
- ✅ Speaker identification and mapping
- ✅ User ID linking

### 3. Flexibility
- ✅ Optional speaker names (defaults to "S1" and "S2")
- ✅ Optional user metadata for Zep
- ✅ Graceful fallback if Zep fails

### 4. Database Updates
Both functions now save the same data structure:
- ✅ Transcript with user IDs
- ✅ Facts organized by speaker (S1 and S2)
- ✅ Speaker names (initiator and scanner)
- ✅ Conversation summary

## Comparison: Before vs After

| Feature | Before | After |
|---------|--------|-------|
| **Speaker Names** | Required strings | Optional strings ✅ |
| **Return Format** | Transcript + metadata | Transcript + facts + summary ✅ |
| **Fact Extraction** | ❌ Not implemented | ✅ AI-powered |
| **Summary Generation** | ❌ Not implemented | ✅ AI-powered |
| **Zep Integration** | ❌ Not implemented | ✅ Full integration |
| **Database Updates** | ❌ Not implemented | ✅ Complete |
| **Speaker Mapping** | ❌ Raw speaker labels | ✅ Mapped to user IDs |
| **User Metadata** | ❌ Not supported | ✅ Email and name |

## Processing Flow

### Old Flow (Before)
```
Audio File → Speechmatics → Raw Transcript → Return
```

### New Flow (After)
```
Audio File 
  → Speechmatics (transcription)
  → Get Conversation Details
  → Map Speakers to Users
  → Format for AI
  → AI Analysis (facts + summary)
  → Zep Processing (knowledge graph)
  → Save to Database
  → Return Results
```

## Database Schema Match

Both functions now save data using the same mutation:

```typescript
api.conversations.saveTranscriptData({
  conversationId: Id<"conversations">,
  transcript: Array<{ userId: Id<"users">, text: string }>,
  S1_facts: string[],
  S2_facts: string[],
  initiatorName: string,
  scannerName: string,
  summary: string,
})
```

This ensures:
- ✅ Consistent data structure
- ✅ Same indexes used
- ✅ Compatible queries
- ✅ Identical display logic

## Testing Checklist

- [x] Function signature updated
- [x] Return type updated
- [x] AI integration added
- [x] Zep integration added
- [x] Database updates added
- [x] Import page updated
- [x] Type errors resolved
- [ ] Test with real audio file import
- [ ] Verify facts extraction works
- [ ] Verify summary generation works
- [ ] Verify database saves correctly
- [ ] Verify Zep integration works (if enabled)

## Error Handling

Both functions now handle errors consistently:

**Speechmatics Errors:**
```typescript
try {
  const response = await client.transcribe(...);
} catch (error: any) {
  console.error("Speechmatics error:", error);
  throw new Error(`Speechmatics transcription failed: ${error.message}`);
}
```

**Zep Errors:**
```typescript
try {
  await processWithZep(...);
} catch (error) {
  console.error("Zep processing error:", error);
  // Continue without Zep (non-blocking)
}
```

## Environment Variables Required

Both functions now require:
```env
# Speechmatics
SPEECHMATICS_API_KEY=your_api_key_here

# OpenAI (for fact extraction & summary)
OPENAI_API_KEY=your_api_key_here

# Zep (optional, for knowledge graph)
ZEP_API_KEY=your_api_key_here
ZEP_GRAPH_ID=all_users_htn
```

## Migration Notes

### For Existing Calls to `batchTranscribe`

**Old way:**
```typescript
await batchTranscribe({
  storageId: id,
  conversationId: convId,
  initiatorUserName: "John",
  scannerUserName: "Jane",
});
```

**New way:**
```typescript
await batchTranscribe({
  storageId: id,
  conversationId: convId,
  initiatorName: "John",
  scannerName: "Jane",
  userEmail: "john@example.com", // optional
  userName: "John Doe", // optional
});
```

### Changes to Make
1. Rename `initiatorUserName` → `initiatorName`
2. Rename `scannerUserName` → `scannerName`
3. Make both optional (they'll default to "S1" and "S2")
4. Optionally add `userEmail` and `userName` for Zep

## Summary

The `batchTranscribe` function has been completely updated to match the full functionality of `processRealtimeTranscript`. Both functions now:

✅ **Accept the same inputs**
✅ **Return the same outputs**
✅ **Perform the same processing**
✅ **Update the database identically**
✅ **Integrate with the same external services**

This ensures a consistent experience whether users are:
- Recording live conversations (→ `processRealtimeTranscript`)
- Importing audio files (→ `batchTranscribe`)

Both paths now result in the same high-quality data: transcripts, extracted facts, generated summaries, and knowledge graph relationships! 🎉
