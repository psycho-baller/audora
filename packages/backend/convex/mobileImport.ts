"use node";

import { v } from "convex/values";
import { action, ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
/**
 * Process imported audio file from mobile app
 * This is a simplified version that processes a single audio file
 * (React Native doesn't have Web Audio API for splitting)
 */
export const processImportedAudio = action({
  args: {
    storageId: v.id("_storage"),
    friendId: v.id("users"),
    location: v.optional(v.string()),
  },
  returns: v.object({
    conversationId: v.id("conversations"),
    success: v.boolean(),
  }),
  handler: async (ctx, args): Promise<{ conversationId: Id<"conversations">; success: boolean }> => {
    console.log("Starting mobile audio import processing");

    // Step 1: Get current user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const tokenIdentifier = identity.tokenIdentifier.split("|")[1];
    const currentUser = await ctx.runQuery(api.users.getCurrentUser);
    if (!currentUser) {
      throw new Error("Current user not found");
    }

    // Step 2: Get friend details
    const friend = await ctx.runQuery(api.users.get, { id: args.friendId });
    if (!friend) {
      throw new Error("Friend not found");
    }

    // Step 3: Create conversation
    console.log("Creating conversation...");
    const conversation: { id: Id<"conversations">; inviteCode: string } = await ctx.runMutation(api.conversations.create, {
      location: args.location || "Imported from Mobile",
    });

    // Step 4: Link conversation to friend
    console.log("Linking conversation to friend...");
    await ctx.runMutation(api.conversations.linkConversationToFriend, {
      conversationId: conversation.id,
      friendId: args.friendId,
    });

    // Step 5: Save audio storage ID
    console.log("Saving audio storage ID...");
    await ctx.runMutation(api.conversations.saveAudioStorageId, {
      conversationId: conversation.id,
      storageId: args.storageId,
    });

    // Step 6: Transcribe and analyze using existing batch transcription
    console.log("Starting batch transcription and analysis...");
    try {
      await ctx.runAction(api.speechmaticsBatch.batchTranscribe, {
        storageId: args.storageId,
        conversationId: conversation.id,
        initiatorName: currentUser.name || "You",
        scannerName: friend.name || "Friend",
        userEmail: currentUser.email,
        userName: currentUser.name,
      });

      console.log("Mobile audio import completed successfully");
      return {
        conversationId: conversation.id,
        success: true,
      };
    } catch (error: any) {
      console.error("Transcription failed:", error);
      // Mark conversation as ended even if transcription fails
      await ctx.runMutation(api.conversations.updateStatus, {
        conversationId: conversation.id,
        status: "ended",
      });
      throw new Error(`Failed to process audio: ${error.message}`);
    }
  },
});

/**
 * Process imported audio file in chunks (for larger files)
 * This version processes the audio in multiple chunks to handle longer recordings
 */
export const processImportedAudioInChunks = action({
  args: {
    storageIds: v.array(v.id("_storage")),
    friendId: v.id("users"),
    location: v.optional(v.string()),
  },
  returns: v.object({
    conversationId: v.id("conversations"),
    success: v.boolean(),
  }),
  handler: async (ctx, args): Promise<{ conversationId: Id<"conversations">; success: boolean }> => {
    console.log(`Starting mobile audio import with ${args.storageIds.length} chunks`);

    // Step 1: Get current user
    const currentUser = await ctx.runQuery(api.users.getCurrentUser);
    if (!currentUser) {
      throw new Error("Current user not found");
    }

    // Step 2: Get friend details
    const friend = await ctx.runQuery(api.users.get, { id: args.friendId });
    if (!friend) {
      throw new Error("Friend not found");
    }

    // Step 3: Create conversation
    console.log("Creating conversation...");
    const conversation: { id: Id<"conversations">; inviteCode: string } = await ctx.runMutation(api.conversations.create, {
      location: args.location || "Imported from Mobile",
    });

    // Step 4: Link conversation to friend
    console.log("Linking conversation to friend...");
    await ctx.runMutation(api.conversations.linkConversationToFriend, {
      conversationId: conversation.id,
      friendId: args.friendId,
    });

    // Step 5: Save first audio chunk's storage ID (for playback)
    console.log("Saving audio storage ID...");
    await ctx.runMutation(api.conversations.saveAudioStorageId, {
      conversationId: conversation.id,
      storageId: args.storageIds[0],
    });

    // Step 6: Process each chunk
    const allTranscripts: Array<{ speaker: string; text: string }> = [];
    let allS1Facts: string[] = [];
    let allS2Facts: string[] = [];
    let allSummaries: string[] = [];

    for (let i = 0; i < args.storageIds.length; i++) {
      const chunkNum = i + 1;
      const storageId = args.storageIds[i];

      console.log(`Processing chunk ${chunkNum}/${args.storageIds.length}...`);

      try {
        // Transcribe chunk only (no DB save)
        const chunkResult = await ctx.runAction(api.speechmaticsBatch.transcribeChunkOnly, {
          storageId,
        });

        // Combine results
        allTranscripts.push(...chunkResult.transcript);
        allS1Facts.push(...chunkResult.S1_facts);
        allS2Facts.push(...chunkResult.S2_facts);
        allSummaries.push(chunkResult.summary);

        console.log(`Chunk ${chunkNum} processed successfully`);
      } catch (error: any) {
        console.error(`Failed to process chunk ${chunkNum}:`, error);
        throw new Error(`Failed to process chunk ${chunkNum}: ${error.message}`);
      }
    }

    // Step 7: Deduplicate facts
    allS1Facts = [...new Set(allS1Facts)];
    allS2Facts = [...new Set(allS2Facts)];

    // Step 8: Combine summaries
    const combinedSummary = allSummaries.length > 1
      ? `Combined conversation summary:\n\n${allSummaries.map((s, i) => `Part ${i + 1}: ${s}`).join('\n\n')}`
      : allSummaries[0] || "Conversation imported from mobile app.";

    console.log("All chunks processed! Saving combined results...");

    // Step 9: Map speakers to user IDs
    const transcriptWithUserIds = allTranscripts.map(turn => {
      const userId = turn.speaker === "S1" ? currentUser._id : args.friendId;
      return {
        userId: userId as Id<"users">,
        text: turn.text,
      };
    });

    // Step 10: Save combined transcript data to database
    await ctx.runMutation(api.conversations.saveTranscriptData, {
      conversationId: conversation.id,
      transcript: transcriptWithUserIds,
      S1_facts: allS1Facts,
      S2_facts: allS2Facts,
      initiatorName: currentUser.name || "You",
      scannerName: friend.name || "Friend",
      summary: combinedSummary,
    });

    console.log("Mobile audio import completed successfully");
    return {
      conversationId: conversation.id,
      success: true,
    };
  },
});
