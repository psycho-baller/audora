import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Appends or updates a transcript turn during a live recording.
 * This allows real-time synchronization across devices.
 */
export const appendTranscriptTurn = mutation({
  args: {
    conversationId: v.id("conversations"),
    speaker: v.string(), // "S1" or "S2"
    text: v.string(),
    order: v.number(),
    timestamp: v.optional(v.number()),
    words: v.optional(v.array(v.object({
      word: v.string(),
      startTime: v.number(),
      endTime: v.number(),
      wordId: v.string(),
    }))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get conversation to verify access and get user IDs
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Map speaker label to userId
    let userId = conversation.initiatorUserId;
    if (args.speaker === "S2" && conversation.scannerUserId) {
      userId = conversation.scannerUserId;
    }

    // Check if this turn already exists (by conversation and order)
    const existingTurn = await ctx.db
      .query("transcriptTurns")
      .withIndex("by_conversation_and_order", (q) =>
        q.eq("conversationId", args.conversationId).eq("order", args.order)
      )
      .unique();

    if (existingTurn) {
      // Update existing turn (e.g., if text was refined)
      await ctx.db.patch(existingTurn._id, {
        text: args.text,
        timestamp: args.timestamp,
        words: args.words,
        userId, // In case speaker detection changed
      });
      return existingTurn._id;
    } else {
      // Insert new turn
      const turnId = await ctx.db.insert("transcriptTurns", {
        conversationId: args.conversationId,
        userId,
        text: args.text,
        order: args.order,
        timestamp: args.timestamp,
        words: args.words,
      });
      return turnId;
    }
  },
});

/**
 * Gets real-time transcript turns for a conversation.
 */
export const getTranscript = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const turns = await ctx.db
      .query("transcriptTurns")
      .withIndex("by_conversation_and_order", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    // Return with speaker label derived from userId -> S1/S2 logic if needed,
    // or just return raw turns and let client map based on userId.
    // Client has conversation data so it can map.
    // However, the `transcriptTurns` table has `userId`.
    // It's helpful to return `speaker` label if possible, but simplest is to return turns.

    // We sort by order (index handles it mostly, but let's sort to be safe)
    return turns.sort((a, b) => a.order - b.order);
  },
});
