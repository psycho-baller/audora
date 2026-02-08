"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

type TimedTranscriptTurn = {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
  words: Array<{
    word: string;
    startTime: number;
    endTime: number;
    wordId: string;
  }>;
};

function offsetChunkTurns(chunkResult: any, offsetSeconds: number): TimedTranscriptTurn[] {
  const rawTurns = Array.isArray(chunkResult?.transcript) ? chunkResult.transcript : [];
  return rawTurns.map((turn: any) => ({
    speaker: turn.speaker,
    text: turn.text,
    startTime: (turn.startTime || 0) + offsetSeconds,
    endTime: (turn.endTime || 0) + offsetSeconds,
    words: Array.isArray(turn.words)
      ? turn.words.map((word: any) => ({
          word: word.word,
          startTime: (word.startTime || 0) + offsetSeconds,
          endTime: (word.endTime || 0) + offsetSeconds,
          wordId: word.wordId || "",
        }))
      : [],
  }));
}

function inferChunkDurationSeconds(chunkResult: any): number {
  const rawTurns = Array.isArray(chunkResult?.transcript) ? chunkResult.transcript : [];
  const inferredDuration = rawTurns.reduce(
    (max: number, turn: any) => Math.max(max, Number(turn?.endTime) || 0),
    0
  );
  const reportedDuration =
    typeof chunkResult?.durationSeconds === "number" ? chunkResult.durationSeconds : 0;
  return Math.max(inferredDuration, reportedDuration, 0);
}
/**
 * Process imported audio file from mobile app
 * This is a simplified version that processes a single audio file
 * (React Native doesn't have Web Audio API for splitting)
 * 
 * Supports both:
 * - Conversations with a friend (when friendId is provided)
 * - Solo conversations/self-talk (when friendId is omitted)
 */
export const processImportedAudio = action({
  args: {
    storageId: v.id("_storage"),
    friendId: v.optional(v.id("users")),
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

    const currentUser = await ctx.runQuery(api.users.getCurrentUser);
    if (!currentUser) {
      throw new Error("Current user not found");
    }

    // Step 2: Get friend details (if provided)
    let friend = null;
    if (args.friendId) {
      friend = await ctx.runQuery(api.users.get, { id: args.friendId });
      if (!friend) {
        throw new Error("Friend not found");
      }
    }

    // Step 3: Create conversation
    console.log("Creating conversation...");
    const conversation: { id: Id<"conversations">; inviteCode: string } = await ctx.runMutation(api.conversations.create, {
      location: args.location || "Imported from Mobile",
    });

    // Step 4: Link conversation to friend (if provided)
    if (args.friendId) {
      console.log("Linking conversation to friend...");
      await ctx.runMutation(api.conversations.linkConversationToFriend, {
        conversationId: conversation.id,
        friendId: args.friendId,
      });
    } else {
      console.log("Solo conversation - no friend to link");
    }

    // Step 5: Save audio storage ID
    console.log("Saving audio storage ID...");
    await ctx.runMutation(api.conversations.saveAudioStorageId, {
      conversationId: conversation.id,
      storageId: args.storageId,
    });

    // Step 6: Transcribe based on conversation type
    try {
      if (args.friendId) {
        // Multi-speaker conversation: use Speechmatics with diarization
        console.log("Starting batch transcription and analysis with Speechmatics...");
        await ctx.runAction(api.speechmaticsBatch.batchTranscribe, {
          storageId: args.storageId,
          conversationId: conversation.id,
          initiatorName: currentUser.name || "You",
          scannerName: friend?.name || "Friend",
          userEmail: currentUser.email,
          userName: currentUser.name,
        });
      } else {
        // Solo conversation: prefer Speechmatics chunk transcription (word-level timing), fall back to Whisper.
        let transcript: Array<{
          userId: Id<"users">;
          text: string;
          startTime?: number;
          words?: Array<{
            word: string;
            startTime: number;
            endTime: number;
            wordId: string;
          }>;
        }> = [];
        let summary = "Solo conversation transcript";

        try {
          console.log("Starting solo transcription with Speechmatics...");
          const soloChunkResult: any = await ctx.runAction(api.speechmaticsBatch.transcribeChunkOnly, {
            storageId: args.storageId,
          });
          const timedTurns = offsetChunkTurns(soloChunkResult, 0);

          transcript = timedTurns.map((turn, turnIndex) => ({
            userId: currentUser._id,
            text: turn.text,
            startTime: turn.startTime,
            words: turn.words.map((word, wordIndex) => ({
              word: word.word,
              startTime: word.startTime,
              endTime: word.endTime,
              wordId: `mobile-solo-t${turnIndex}-w${wordIndex}`,
            })),
          }));

          if (soloChunkResult?.summary) {
            summary = soloChunkResult.summary;
          }
        } catch (speechmaticsError) {
          console.error("Speechmatics solo transcription failed, falling back to Whisper:", speechmaticsError);
        }

        if (transcript.length === 0) {
          console.log("Starting solo transcription with Whisper...");
          const whisperResult = await ctx.runAction(api.whisperTranscription.transcribeSoloAudio, {
            storageId: args.storageId,
          });
          transcript = [{
            userId: currentUser._id,
            text: whisperResult.text,
          }];
        }

        await ctx.runMutation(api.conversations.saveTranscriptData, {
          conversationId: conversation.id,
          transcript,
          S1_facts: [],
          S2_facts: [],
          initiatorName: currentUser.name || "You",
          scannerName: "Self",
          summary,
        });

        // Mark conversation as ended
        await ctx.runMutation(api.conversations.updateStatus, {
          conversationId: conversation.id,
          status: "ended",
        });
      }

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
 * 
 * Supports both:
 * - Conversations with a friend (when friendId is provided)
 * - Solo conversations/self-talk (when friendId is omitted)
 */
export const processImportedAudioInChunks = action({
  args: {
    storageIds: v.array(v.id("_storage")),
    friendId: v.optional(v.id("users")),
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

    // Step 2: Get friend details (if provided)
    let friend = null;
    if (args.friendId) {
      friend = await ctx.runQuery(api.users.get, { id: args.friendId });
      if (!friend) {
        throw new Error("Friend not found");
      }
    }

    // Step 3: Create conversation
    console.log("Creating conversation...");
    const conversation: { id: Id<"conversations">; inviteCode: string } = await ctx.runMutation(api.conversations.create, {
      location: args.location || "Imported from Mobile",
    });

    // Step 4: Link conversation to friend (if provided)
    if (args.friendId) {
      console.log("Linking conversation to friend...");
      await ctx.runMutation(api.conversations.linkConversationToFriend, {
        conversationId: conversation.id,
        friendId: args.friendId,
      });
    } else {
      console.log("Solo conversation - no friend to link");
    }

    // Step 5: Save first audio chunk's storage ID (for playback)
    console.log("Saving audio storage ID...");
    await ctx.runMutation(api.conversations.saveAudioStorageId, {
      conversationId: conversation.id,
      storageId: args.storageIds[0],
    });

    // Step 6: Process each chunk based on conversation type
    if (args.friendId) {
      // Multi-speaker conversation: use Speechmatics
      const allTranscripts: TimedTranscriptTurn[] = [];
      let allS1Facts: string[] = [];
      let allS2Facts: string[] = [];
      let allSummaries: string[] = [];
      let cumulativeOffsetSeconds = 0;

      for (let i = 0; i < args.storageIds.length; i++) {
        const chunkNum = i + 1;
        const storageId = args.storageIds[i];

        console.log(`Processing chunk ${chunkNum}/${args.storageIds.length}...`);

        try {
          // Transcribe chunk only (no DB save)
          const chunkResult: any = await ctx.runAction(api.speechmaticsBatch.transcribeChunkOnly, {
            storageId,
          });

          const timedTurns = offsetChunkTurns(chunkResult, cumulativeOffsetSeconds);
          allTranscripts.push(...timedTurns);
          allS1Facts.push(...chunkResult.S1_facts);
          allS2Facts.push(...chunkResult.S2_facts);
          allSummaries.push(chunkResult.summary);
          cumulativeOffsetSeconds += inferChunkDurationSeconds(chunkResult);

          console.log(`Chunk ${chunkNum} processed successfully`);
        } catch (error: any) {
          console.error(`Failed to process chunk ${chunkNum}:`, error);
          throw new Error(`Failed to process chunk ${chunkNum}: ${error.message}`);
        }
      }

      // Deduplicate facts
      allS1Facts = [...new Set(allS1Facts)];
      allS2Facts = [...new Set(allS2Facts)];

      // Combine summaries
      const combinedSummary = allSummaries.length > 1
        ? `Combined conversation summary:\n\n${allSummaries.map((s, i) => `Part ${i + 1}: ${s}`).join('\n\n')}`
        : allSummaries[0] || "Conversation imported from mobile app.";

      console.log("All chunks processed! Saving combined results...");

      const speakerToUserId: Record<string, Id<"users">> = {
        S1: currentUser._id as Id<"users">,
        S2: args.friendId as Id<"users">,
      };
      const transcriptWithUserIds = allTranscripts.map((turn, turnIndex) => ({
        userId: (speakerToUserId[turn.speaker] || currentUser._id) as Id<"users">,
        text: turn.text,
        startTime: turn.startTime,
        words: turn.words.map((word, wordIndex) => ({
          word: word.word,
          startTime: word.startTime,
          endTime: word.endTime,
          wordId: `mobile-import-t${turnIndex}-w${wordIndex}`,
        })),
      }));

      // Save combined transcript data to database
      await ctx.runMutation(api.conversations.saveTranscriptData, {
        conversationId: conversation.id,
        transcript: transcriptWithUserIds,
        S1_facts: allS1Facts,
        S2_facts: allS2Facts,
        initiatorName: currentUser.name || "You",
        scannerName: friend?.name || "Friend",
        summary: combinedSummary,
      });
    } else {
      // Solo conversation: use Speechmatics chunk transcription with timing, fallback to Whisper per chunk.
      const allTranscripts: TimedTranscriptTurn[] = [];
      const allSummaries: string[] = [];
      let cumulativeOffsetSeconds = 0;

      for (let i = 0; i < args.storageIds.length; i++) {
        const chunkNum = i + 1;
        const storageId = args.storageIds[i];

        console.log(`Processing solo chunk ${chunkNum}/${args.storageIds.length}...`);

        try {
          const chunkResult: any = await ctx.runAction(api.speechmaticsBatch.transcribeChunkOnly, {
            storageId,
          });
          const timedTurns = offsetChunkTurns(chunkResult, cumulativeOffsetSeconds);
          allTranscripts.push(...timedTurns);
          allSummaries.push(chunkResult.summary);
          cumulativeOffsetSeconds += inferChunkDurationSeconds(chunkResult);
          console.log(`Chunk ${chunkNum} transcribed with Speechmatics`);
        } catch (error: any) {
          console.error(`Speechmatics failed for chunk ${chunkNum}, falling back to Whisper:`, error);
          const whisperResult = await ctx.runAction(api.whisperTranscription.transcribeSoloAudio, {
            storageId,
          });
          const estimatedDurationSeconds = Math.max(
            whisperResult.text.split(/\s+/).filter(Boolean).length * 0.35,
            5
          );
          allTranscripts.push({
            speaker: "S1",
            text: whisperResult.text,
            startTime: cumulativeOffsetSeconds,
            endTime: cumulativeOffsetSeconds + estimatedDurationSeconds,
            words: [],
          });
          cumulativeOffsetSeconds += estimatedDurationSeconds;
        }
      }

      console.log("All chunks processed! Saving combined results...");

      const transcript = allTranscripts.map((turn, turnIndex) => ({
        userId: currentUser._id,
        text: turn.text,
        startTime: turn.startTime,
        words: turn.words.length > 0
          ? turn.words.map((word, wordIndex) => ({
              word: word.word,
              startTime: word.startTime,
              endTime: word.endTime,
              wordId: `mobile-solo-chunk-t${turnIndex}-w${wordIndex}`,
            }))
          : undefined,
      }));
      const combinedSummary = allSummaries.length > 1
        ? `Combined solo conversation summary:\n\n${allSummaries.map((s, i) => `Part ${i + 1}: ${s}`).join('\n\n')}`
        : allSummaries[0] || "Solo conversation transcript";

      // Save the transcript to database
      await ctx.runMutation(api.conversations.saveTranscriptData, {
        conversationId: conversation.id,
        transcript,
        S1_facts: [],
        S2_facts: [],
        initiatorName: currentUser.name || "You",
        scannerName: "Self",
        summary: combinedSummary,
      });
    }

    console.log("Mobile audio import completed successfully");
    return {
      conversationId: conversation.id,
      success: true,
    };
  },
});
