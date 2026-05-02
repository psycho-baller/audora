import { v } from "convex/values";
import { api } from "./_generated/api";
import { action, internalMutation, mutation, query } from "./_generated/server";

// Generate a random invite code
function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create a new conversation
export const create = mutation({
  args: {
    location: v.optional(v.string()),
    participantMode: v.optional(v.union(v.literal("linked"), v.literal("solo"), v.literal("anonymous"))),
    reusePending: v.optional(v.boolean()),
  },
  returns: v.object({
    id: v.id("conversations"),
    inviteCode: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user from users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier.split("|")[1]))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    if (args.reusePending !== false) {
      // Check for existing pending conversation
      const existingPending = await ctx.db
        .query("conversations")
        .withIndex("by_initiator_and_status", (q) =>
          q.eq("initiatorUserId", user._id).eq("status", "pending")
        )
        .first();

      if (existingPending) {
        return {
          id: existingPending._id,
          inviteCode: existingPending.inviteCode,
        };
      }
    }

    // Create new conversation
    const inviteCode = generateInviteCode();
    const conversationId = await ctx.db.insert("conversations", {
      initiatorUserId: user._id,
      status: "pending",
      inviteCode,
      location: args.location,
      startedAt: Date.now(),
      participantMode: args.participantMode ?? "linked",
    });

    return {
      id: conversationId,
      inviteCode,
    };
  },
});

// Claim scanner spot in a conversation
export const claimScanner = mutation({
  args: {
    conversationId: v.id("conversations"),
    inviteCode: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier.split("|")[1]))
      .unique();

    if (!user) {
      // Create user if not found
      user = await ctx.runMutation(api.users.upsertUser, {});
      if (!user) {
        throw new Error("Failed to create user");
      }
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.inviteCode !== args.inviteCode) {
      throw new Error("Invalid invite code");
    }

    if (conversation.status !== "pending") {
      throw new Error("Conversation is no longer open for joining");
    }

    if (conversation.scannerUserId) {
      throw new Error("Scanner already claimed");
    }

    // Update conversation with scanner
    await ctx.db.patch(args.conversationId, {
      scannerUserId: user._id,
      scannerEmail: user.email,
      status: "active",
      startedAt: Date.now(),
      participantMode: "linked",
    });

    return null;
  },
});

// Start recording without requiring another linked account.
export const startWithoutLinkedParticipant = mutation({
  args: {
    conversationId: v.id("conversations"),
    mode: v.optional(v.union(v.literal("solo"), v.literal("anonymous"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier.split("|")[1]))
      .unique();
    if (!user) {
      throw new Error("User not found");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.initiatorUserId !== user._id) {
      throw new Error("Only the conversation creator can start without invite");
    }

    if (conversation.status !== "pending") {
      throw new Error("Conversation is not pending");
    }

    if (conversation.scannerUserId) {
      throw new Error("Conversation already has a linked participant");
    }

    await ctx.db.patch(args.conversationId, {
      status: "active",
      participantMode: args.mode ?? "anonymous",
      startedAt: Date.now(),
    });

    return null;
  },
});

// Update conversation status
export const updateStatus = mutation({
  args: {
    conversationId: v.id("conversations"),
    status: v.union(v.literal("pending"), v.literal("active"), v.literal("ended")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const updates: any = { status: args.status };

    if (args.status === "ended" && !conversation.endedAt) {
      updates.endedAt = Date.now();
    }

    await ctx.db.patch(args.conversationId, updates);
    return null;
  },
});

// Helper mutation to clean up stuck conversations
export const forceCompleteConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Mark as ended
    await ctx.db.patch(args.conversationId, {
      status: "ended",
      endedAt: conversation.endedAt || Date.now(),
      summary: "Conversation completed without transcript data",
    });

    return null;
  },
});

// Save transcript data after processing
const saveTranscriptDataArgs = {
  conversationId: v.id("conversations"),
  transcript: v.array(v.object({
    userId: v.optional(v.id("users")),
    speaker: v.optional(v.string()),
    text: v.string(),
    startTime: v.optional(v.number()), // Turn-level timestamp
    words: v.optional(v.array(v.object({
      word: v.string(),
      startTime: v.number(),
      endTime: v.number(),
      wordId: v.string(),
    }))),
  })),
  S1_facts: v.array(v.string()),
  S2_facts: v.array(v.string()),
  initiatorName: v.optional(v.string()),
  scannerName: v.optional(v.string()),
  summary: v.string(),
  anonymousSpeakerCount: v.optional(v.number()),
};

function inferTranscriptDurationMs(transcript: any[]): number | null {
  let maxEndTimeSeconds = 0;

  for (const turn of transcript) {
    if (Array.isArray(turn.words)) {
      for (const word of turn.words) {
        const endTime = Number(word?.endTime);
        if (Number.isFinite(endTime)) {
          maxEndTimeSeconds = Math.max(maxEndTimeSeconds, endTime);
        }
      }
    }
  }

  if (maxEndTimeSeconds <= 0) {
    return null;
  }

  return Math.round(maxEndTimeSeconds * 1000);
}

async function saveTranscriptDataImpl(ctx: any, args: any) {
  // Get conversation to extract user IDs
  const conversation = await ctx.db.get(args.conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Save summary to conversation
  const detectedAnonymousSpeakers = new Set(
    args.transcript
      .filter((turn: any) => !turn.userId && turn.speaker)
      .map((turn: any) => turn.speaker as string)
  );
  const anonymousSpeakerCount =
    args.anonymousSpeakerCount ?? detectedAnonymousSpeakers.size;
  const inferredDurationMs = inferTranscriptDurationMs(args.transcript);
  const completedAt =
    inferredDurationMs !== null && conversation.startedAt
      ? conversation.startedAt + inferredDurationMs
      : Date.now();

  const conversationUpdates: {
    summary: string;
    status: "ended";
    endedAt: number;
    anonymousSpeakerCount?: number;
  } = {
    summary: args.summary,
    status: "ended",
    endedAt: completedAt,
  };

  if (anonymousSpeakerCount > 0) {
    conversationUpdates.anonymousSpeakerCount = anonymousSpeakerCount;
  }

  await ctx.db.patch(args.conversationId, conversationUpdates);

  // Replace existing transcript/facts instead of appending.
  // This prevents full-duplicate transcripts when multiple processors
  // (e.g. realtime + batch) submit results for the same conversation.
  const existingTurns = await ctx.db
    .query("transcriptTurns")
    .withIndex("by_conversation_and_order", (q: any) =>
      q.eq("conversationId", args.conversationId)
    )
    .collect();
  for (const turn of existingTurns) {
    await ctx.db.delete(turn._id);
  }

  const existingFacts = await ctx.db
    .query("conversationFacts")
    .withIndex("by_conversation", (q: any) => q.eq("conversationId", args.conversationId))
    .collect();
  for (const fact of existingFacts) {
    await ctx.db.delete(fact._id);
  }

  // Save transcript turns (with word-level data if available)
  for (let i = 0; i < args.transcript.length; i++) {
    const turn = args.transcript[i];
    // Use turn-level startTime if provided, otherwise calculate from first word
    const timestamp = turn.startTime !== undefined
      ? turn.startTime
      : (turn.words && turn.words.length > 0 ? turn.words[0].startTime : undefined);

    await ctx.db.insert("transcriptTurns", {
      conversationId: args.conversationId,
      userId: turn.userId,
      speaker: turn.speaker,
      text: turn.text,
      order: i,
      timestamp,
      words: turn.words,
    });
  }

  // Save S1 facts (initiator) - all facts in one row
  if (args.S1_facts.length > 0) {
    await ctx.db.insert("conversationFacts", {
      conversationId: args.conversationId,
      userId: conversation.initiatorUserId,
      facts: args.S1_facts,
    });
  }

  // Save S2 facts (scanner) - all facts in one row
  if (conversation.scannerUserId && args.S2_facts.length > 0) {
    await ctx.db.insert("conversationFacts", {
      conversationId: args.conversationId,
      userId: conversation.scannerUserId,
      facts: args.S2_facts,
    });
  }
}

export const saveTranscriptData = mutation({
  args: saveTranscriptDataArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await saveTranscriptDataImpl(ctx, args);
    return null;
  },
});

export const saveTranscriptDataInternal = internalMutation({
  args: saveTranscriptDataArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    await saveTranscriptDataImpl(ctx, args);
    return null;
  },
});

// Get a single conversation
export const get = query({
  args: { id: v.id("conversations") },
  returns: v.union(
    v.object({
      _id: v.id("conversations"),
      _creationTime: v.number(),
      initiatorUserId: v.id("users"),
      scannerUserId: v.optional(v.id("users")),
      scannerEmail: v.optional(v.string()),
      participantMode: v.optional(v.union(v.literal("linked"), v.literal("solo"), v.literal("anonymous"))),
      anonymousSpeakerCount: v.optional(v.number()),
      status: v.union(v.literal("pending"), v.literal("active"), v.literal("ended")),
      inviteCode: v.string(),
      location: v.optional(v.string()),
      startedAt: v.optional(v.number()),
      endedAt: v.optional(v.number()),
      summary: v.optional(v.string()),
      audioStorageId: v.optional(v.id("_storage")),
      speakerMap: v.optional(v.any()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.id);
    return conversation;
  },
});

// Get audio URL for a conversation
export const getAudioUrl = query({
  args: { conversationId: v.id("conversations") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    
    if (!conversation?.audioStorageId) {
      return null;
    }
    
    // Generate temporary URL for audio playback
    const url = await ctx.storage.getUrl(conversation.audioStorageId);
    return url;
  },
});

// List user's conversations
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("conversations"),
      _creationTime: v.number(),
      initiatorUserId: v.id("users"),
      scannerUserId: v.optional(v.id("users")),
      scannerEmail: v.optional(v.string()),
      participantMode: v.optional(v.union(v.literal("linked"), v.literal("solo"), v.literal("anonymous"))),
      anonymousSpeakerCount: v.optional(v.number()),
      status: v.union(v.literal("pending"), v.literal("active"), v.literal("ended")),
      inviteCode: v.string(),
      location: v.optional(v.string()),
      startedAt: v.optional(v.number()),
      endedAt: v.optional(v.number()),
      summary: v.optional(v.string()),
      audioStorageId: v.optional(v.id("_storage")),
      speakerMap: v.optional(v.any()),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier.split("|")[1]))
      .unique();

    if (!user) {
      return [];
    }

    // Get conversations where user is initiator or scanner
    const asInitiator = await ctx.db
      .query("conversations")
      .withIndex("by_initiator", (q) => q.eq("initiatorUserId", user._id))
      .collect();

    const asScanner = await ctx.db
      .query("conversations")
      .withIndex("by_scanner", (q) => q.eq("scannerUserId", user._id))
      .collect();

    console.log("asInitiator", asInitiator);
    console.log("asScanner", asScanner);

    // Combine and sort by creation time
    const all = [...asInitiator, ...asScanner];
    return all.sort((a, b) => b._creationTime - a._creationTime);
  },
});

// Get conversation by invite code
export const getByInviteCode = query({
  args: { inviteCode: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("conversations"),
      _creationTime: v.number(),
      initiatorUserId: v.id("users"),
      scannerUserId: v.optional(v.id("users")),
      scannerEmail: v.optional(v.string()),
      participantMode: v.optional(v.union(v.literal("linked"), v.literal("solo"), v.literal("anonymous"))),
      anonymousSpeakerCount: v.optional(v.number()),
      status: v.union(v.literal("pending"), v.literal("active"), v.literal("ended")),
      inviteCode: v.string(),
      location: v.optional(v.string()),
      startedAt: v.optional(v.number()),
      endedAt: v.optional(v.number()),
      summary: v.optional(v.string()),
      audioStorageId: v.optional(v.id("_storage")),
      speakerMap: v.optional(v.any()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", args.inviteCode))
      .unique();
    return conversation;
  },
});

// Get transcript turns for a conversation
export const getTranscript = query({
  args: { conversationId: v.id("conversations") },
  returns: v.array(
    v.object({
      _id: v.id("transcriptTurns"),
      _creationTime: v.number(),
      conversationId: v.id("conversations"),
      userId: v.optional(v.id("users")),
      speaker: v.optional(v.string()),
      text: v.string(),
      order: v.number(),
      timestamp: v.optional(v.number()),
      words: v.optional(v.array(v.object({
        word: v.string(),
        startTime: v.number(),
        endTime: v.number(),
        wordId: v.string(),
      }))),
    })
  ),
  handler: async (ctx, args) => {
    const turns = await ctx.db
      .query("transcriptTurns")
      .withIndex("by_conversation_and_order", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    // Sort first, then drop exact duplicates (same order + speaker + text).
    // This protects UI for older conversations that were double-saved.
    const sortedTurns = turns.sort((a, b) => a.order - b.order);
    const seen = new Set<string>();
    const dedupedTurns: typeof sortedTurns = [];

    for (const turn of sortedTurns) {
      const key = `${turn.order}|${turn.userId ?? "unknown"}|${turn.speaker ?? "unknown"}|${turn.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedupedTurns.push(turn);
    }

    return dedupedTurns;
  },
});

// Get speaker information for a conversation
export const getSpeakers = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }
    
    const speakers: Record<string, { name: string; email?: string; image?: string }> = {};
    
    // Get initiator info
    const initiator = await ctx.db.get(conversation.initiatorUserId);
    if (initiator) {
      speakers[conversation.initiatorUserId] = {
        name: initiator.name || initiator.email || "Speaker 1",
        email: initiator.email,
        image: initiator.image,
      };
    }
    
    // Get scanner info if exists
    if (conversation.scannerUserId) {
      const scanner = await ctx.db.get(conversation.scannerUserId);
      if (scanner) {
        speakers[conversation.scannerUserId] = {
          name: scanner.name || scanner.email || "Speaker 2",
          email: scanner.email,
          image: scanner.image,
        };
      }
    }

    // Include anonymous speaker labels for conversations without linked users.
    const turns = await ctx.db
      .query("transcriptTurns")
      .withIndex("by_conversation_and_order", (q) => q.eq("conversationId", args.conversationId))
      .collect();
    for (const turn of turns) {
      if (!turn.userId && turn.speaker) {
        const anonymousKey = `anonymous:${turn.speaker}`;
        if (!speakers[anonymousKey]) {
          speakers[anonymousKey] = { name: turn.speaker };
        }
      }
    }
    
    return speakers;
  },
});

// Get facts for a conversation
export const getFacts = query({
  args: { conversationId: v.id("conversations") },
  returns: v.array(
    v.object({
      _id: v.id("conversationFacts"),
      _creationTime: v.number(),
      conversationId: v.id("conversations"),
      userId: v.id("users"),
      facts: v.array(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const facts = await ctx.db
      .query("conversationFacts")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();
    return facts;
  },
});

// Generate upload URL for audio
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// Save audio storage ID to conversation
export const saveAudioStorageId = mutation({
  args: {
    conversationId: v.id("conversations"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      audioStorageId: args.storageId,
    });
    return null;
  },
});

// Link conversation with a specific friend (for imports)
export const linkConversationToFriend = mutation({
  args: {
    conversationId: v.id("conversations"),
    friendId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Get friend's details
    const friend = await ctx.db.get(args.friendId);
    if (!friend) {
      throw new Error("Friend not found");
    }

    // Update conversation with friend as scanner
    await ctx.db.patch(args.conversationId, {
      scannerUserId: args.friendId,
      scannerEmail: friend.email,
      status: "active",
      participantMode: "linked",
    });

    return null;
  },
});

// Import text transcript (dev mode only)
// Parses a text file with format: SPEAKER: S1\nText\nSPEAKER: S2\nText...
export const importTextTranscript = action({
  args: {
    conversationId: v.id("conversations"),
    textContent: v.string(),
    initiatorName: v.optional(v.string()),
    scannerName: v.optional(v.string()),
  },
  returns: v.object({
    transcript: v.array(v.object({ speaker: v.string(), text: v.string() })),
    S1_facts: v.array(v.string()),
    S2_facts: v.array(v.string()),
    summary: v.string(),
  }),
  handler: async (ctx, args) => {
    console.log("Processing text transcript import (dev mode)");

    // Parse the text content
    const lines = args.textContent.split('\n');
    const transcript: Array<{ speaker: string; text: string }> = [];
    let currentSpeaker = '';
    let currentText = '';

    for (const line of lines) {
      const speakerMatch = line.match(/^SPEAKER:\s*(S[12])$/i);

      if (speakerMatch) {
        // Save previous turn if exists
        if (currentSpeaker && currentText.trim()) {
          transcript.push({
            speaker: currentSpeaker,
            text: currentText.trim(),
          });
        }
        // Start new turn
        currentSpeaker = speakerMatch[1].toUpperCase();
        currentText = '';
      } else if (line.trim() && currentSpeaker) {
        // Add to current text
        if (currentText) currentText += ' ';
        currentText += line.trim();
      }
    }

    // Save last turn
    if (currentSpeaker && currentText.trim()) {
      transcript.push({
        speaker: currentSpeaker,
        text: currentText.trim(),
      });
    }

    if (transcript.length === 0) {
      throw new Error("No valid transcript found in text file");
    }

    console.log(`Parsed ${transcript.length} turns from text file`);

    // Format for AI analysis
    const speakerMap: Record<string, string> = {
      S1: args.initiatorName || "S1",
      S2: args.scannerName || "S2",
    };

    const formattedTranscript = transcript
      .map(turn => `${speakerMap[turn.speaker] || turn.speaker}: ${turn.text}`)
      .join("\n");

    // Use AI for facts extraction and summary generation
    const { openai } = await import("@ai-sdk/openai");
    const { generateObject } = await import("ai");
    const { z } = await import("zod");

    const { object: aiAnalysis } = await generateObject({
      model: openai("gpt-4o"),
      schema: z.object({
        S1_facts: z.array(z.string()).describe(`Facts extracted for ${speakerMap["S1"]}`).default([]),
        S2_facts: z.array(z.string()).describe(`Facts extracted for ${speakerMap["S2"]}`).default([]),
        summary: z.string().describe("Brief summary of the conversation").default(""),
      }),
      prompt: `You are an AI assistant that analyzes conversation transcripts to extract key facts and generate summaries.

SPEAKERS:
- ${speakerMap["S1"]}: The person who initiated the conversation
- ${speakerMap["S2"]}: The person who joined the conversation

REQUIREMENTS:
- Extract only explicit, concrete facts directly stated by each person
- Do not include questions, opinions, or interpretations in facts
- Facts should be organized by speaker name
- Use the actual speaker names provided above as keys in the facts object
- Generate a concise summary of key points and outcomes

TRANSCRIPT:
${formattedTranscript}

Provide:
1. S1_facts: Key facts extracted for ${args.initiatorName || "Speaker 1"}
2. S2_facts: Key facts extracted for ${args.scannerName || "Speaker 2"}
3. summary: Concise summary of key points and outcomes`,
    });

    console.log("AI analysis complete:", aiAnalysis);

    return {
      transcript,
      S1_facts: aiAnalysis.S1_facts,
      S2_facts: aiAnalysis.S2_facts,
      summary: aiAnalysis.summary,
    };
  },
});
