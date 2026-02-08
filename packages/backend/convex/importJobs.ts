import { anyApi } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

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

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function combinedSummaryFromChunks(chunkSummaries: string[]): string {
  if (chunkSummaries.length === 0) {
    return "Conversation imported from audio file.";
  }
  if (chunkSummaries.length === 1) {
    return chunkSummaries[0] || "Conversation imported from audio file.";
  }
  return `Combined conversation summary:\n\n${chunkSummaries
    .map((summary, index) => `Part ${index + 1}: ${summary}`)
    .join("\n\n")}`;
}

async function getCurrentUserOrThrow(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier.split("|")[1]))
    .unique();

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

export const createAudioImportJob = mutation({
  args: {
    conversationId: v.id("conversations"),
    chunkStorageIds: v.array(v.id("_storage")),
    participantMode: v.union(v.literal("contact"), v.literal("solo"), v.literal("anonymous")),
    friendId: v.optional(v.id("users")),
    initiatorName: v.optional(v.string()),
    scannerName: v.optional(v.string()),
  },
  returns: v.object({
    jobId: v.id("importJobs"),
  }),
  handler: async (ctx, args) => {
    if (args.chunkStorageIds.length === 0) {
      throw new Error("At least one audio chunk is required");
    }

    if (args.participantMode === "contact" && !args.friendId) {
      throw new Error("Friend is required for contact mode");
    }

    const user = await getCurrentUserOrThrow(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    if (conversation.initiatorUserId !== user._id) {
      throw new Error("Only the conversation creator can import audio");
    }

    const existingJobs = await ctx.db
      .query("importJobs")
      .withIndex("by_import_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    const hasActiveJob = existingJobs.some(
      (job) => job.status === "queued" || job.status === "processing" || job.status === "finalizing"
    );
    if (hasActiveJob) {
      throw new Error("An import is already in progress for this conversation");
    }

    const jobId = await ctx.db.insert("importJobs", {
      conversationId: args.conversationId,
      initiatorUserId: user._id,
      friendId: args.friendId,
      participantMode: args.participantMode,
      status: "queued",
      totalChunks: args.chunkStorageIds.length,
      processedChunks: 0,
      chunkStorageIds: args.chunkStorageIds,
      initiatorName: args.initiatorName,
      scannerName: args.scannerName,
    });

    await ctx.scheduler.runAfter(0, anyApi.importJobs.processNextChunk, {
      jobId,
      chunkIndex: 0,
      cumulativeOffsetSeconds: 0,
    });

    return { jobId };
  },
});

export const get = query({
  args: {
    jobId: v.id("importJobs"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("importJobs"),
      conversationId: v.id("conversations"),
      status: v.union(
        v.literal("queued"),
        v.literal("processing"),
        v.literal("finalizing"),
        v.literal("completed"),
        v.literal("failed")
      ),
      totalChunks: v.number(),
      processedChunks: v.number(),
      error: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier.split("|")[1]))
      .unique();
    if (!user) {
      return null;
    }

    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return null;
    }
    if (job.initiatorUserId !== user._id) {
      return null;
    }

    return {
      _id: job._id,
      conversationId: job.conversationId,
      status: job.status,
      totalChunks: job.totalChunks,
      processedChunks: job.processedChunks,
      error: job.error,
    };
  },
});

export const getJobInternal = internalQuery({
  args: {
    jobId: v.id("importJobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const listChunkResultsInternal = internalQuery({
  args: {
    jobId: v.id("importJobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("importJobChunkResults")
      .withIndex("by_import_job_and_chunk", (q) => q.eq("jobId", args.jobId))
      .collect();
  },
});

export const markJobProcessingInternal = internalMutation({
  args: {
    jobId: v.id("importJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    if (job.status !== "queued") return;
    await ctx.db.patch(args.jobId, {
      status: "processing",
      startedAt: Date.now(),
      error: undefined,
    });
  },
});

export const updateJobProgressInternal = internalMutation({
  args: {
    jobId: v.id("importJobs"),
    processedChunks: v.number(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    await ctx.db.patch(args.jobId, {
      processedChunks: Math.min(args.processedChunks, job.totalChunks),
      status: "processing",
    });
  },
});

export const markJobFinalizingInternal = internalMutation({
  args: {
    jobId: v.id("importJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    if (job.status === "failed" || job.status === "completed") return;
    await ctx.db.patch(args.jobId, {
      status: "finalizing",
      processedChunks: job.totalChunks,
    });
  },
});

export const markJobCompletedInternal = internalMutation({
  args: {
    jobId: v.id("importJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    await ctx.db.patch(args.jobId, {
      status: "completed",
      processedChunks: job.totalChunks,
      completedAt: Date.now(),
      error: undefined,
    });
  },
});

export const markJobFailedInternal = internalMutation({
  args: {
    jobId: v.id("importJobs"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    await ctx.db.patch(args.jobId, {
      status: "failed",
      error: args.error.slice(0, 1000),
      completedAt: Date.now(),
    });
  },
});

export const upsertChunkResultInternal = internalMutation({
  args: {
    jobId: v.id("importJobs"),
    chunkIndex: v.number(),
    transcript: v.array(v.object({
      speaker: v.string(),
      text: v.string(),
      startTime: v.number(),
      endTime: v.number(),
      words: v.array(v.object({
        word: v.string(),
        startTime: v.number(),
        endTime: v.number(),
        wordId: v.string(),
      })),
    })),
    S1_facts: v.array(v.string()),
    S2_facts: v.array(v.string()),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("importJobChunkResults")
      .withIndex("by_import_job_and_chunk", (q) =>
        q.eq("jobId", args.jobId).eq("chunkIndex", args.chunkIndex)
      )
      .first();

    const payload = {
      transcript: args.transcript,
      S1_facts: args.S1_facts,
      S2_facts: args.S2_facts,
      summary: args.summary,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return;
    }

    await ctx.db.insert("importJobChunkResults", {
      jobId: args.jobId,
      chunkIndex: args.chunkIndex,
      ...payload,
    });
  },
});

export const cleanupChunkResultsInternal = internalMutation({
  args: {
    jobId: v.id("importJobs"),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("importJobChunkResults")
      .withIndex("by_import_job", (q) => q.eq("jobId", args.jobId))
      .collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
  },
});

export const processNextChunk = internalAction({
  args: {
    jobId: v.id("importJobs"),
    chunkIndex: v.number(),
    cumulativeOffsetSeconds: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(anyApi.importJobs.getJobInternal, {
      jobId: args.jobId,
    });

    if (!job) {
      return null;
    }
    if (job.status === "failed" || job.status === "completed") {
      return null;
    }

    if (args.chunkIndex === 0 && job.status === "queued") {
      await ctx.runMutation(anyApi.importJobs.markJobProcessingInternal, {
        jobId: args.jobId,
      });
    }

    const storageId = job.chunkStorageIds[args.chunkIndex];
    if (!storageId) {
      await ctx.scheduler.runAfter(0, anyApi.importJobs.finalizeJob, {
        jobId: args.jobId,
      });
      return null;
    }

    try {
      const chunkResult: any = await ctx.runAction(anyApi.speechmaticsBatch.transcribeChunkOnly, {
        storageId,
      });

      const timedTurns = offsetChunkTurns(chunkResult, args.cumulativeOffsetSeconds);
      await ctx.runMutation(anyApi.importJobs.upsertChunkResultInternal, {
        jobId: args.jobId,
        chunkIndex: args.chunkIndex,
        transcript: timedTurns,
        S1_facts: Array.isArray(chunkResult?.S1_facts) ? chunkResult.S1_facts : [],
        S2_facts: Array.isArray(chunkResult?.S2_facts) ? chunkResult.S2_facts : [],
        summary: typeof chunkResult?.summary === "string" ? chunkResult.summary : "",
      });

      const chunkDuration = inferChunkDurationSeconds(chunkResult);
      const processedChunks = args.chunkIndex + 1;
      await ctx.runMutation(anyApi.importJobs.updateJobProgressInternal, {
        jobId: args.jobId,
        processedChunks,
      });

      if (processedChunks >= job.totalChunks) {
        await ctx.scheduler.runAfter(0, anyApi.importJobs.finalizeJob, {
          jobId: args.jobId,
        });
      } else {
        await ctx.scheduler.runAfter(0, anyApi.importJobs.processNextChunk, {
          jobId: args.jobId,
          chunkIndex: processedChunks,
          cumulativeOffsetSeconds: args.cumulativeOffsetSeconds + chunkDuration,
        });
      }
    } catch (error: any) {
      await ctx.runMutation(anyApi.importJobs.markJobFailedInternal, {
        jobId: args.jobId,
        error: `Chunk ${args.chunkIndex + 1} failed: ${error?.message || "Unknown error"}`,
      });
    }

    return null;
  },
});

export const finalizeJob = internalAction({
  args: {
    jobId: v.id("importJobs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(anyApi.importJobs.getJobInternal, {
      jobId: args.jobId,
    });

    if (!job) return null;
    if (job.status === "failed" || job.status === "completed") return null;

    try {
      await ctx.runMutation(anyApi.importJobs.markJobFinalizingInternal, {
        jobId: args.jobId,
      });

      const chunkResults: any[] = await ctx.runQuery(anyApi.importJobs.listChunkResultsInternal, {
        jobId: args.jobId,
      });
      const orderedChunkResults = [...chunkResults].sort((a, b) => a.chunkIndex - b.chunkIndex);

      if (orderedChunkResults.length === 0) {
        throw new Error("No chunk results were produced");
      }

      const allTranscripts: TimedTranscriptTurn[] = [];
      let allS1Facts: string[] = [];
      let allS2Facts: string[] = [];
      const allSummaries: string[] = [];

      for (const chunkResult of orderedChunkResults) {
        allTranscripts.push(...chunkResult.transcript);
        allS1Facts.push(...chunkResult.S1_facts);
        allS2Facts.push(...chunkResult.S2_facts);
        allSummaries.push(chunkResult.summary);
      }

      allS1Facts = dedupeStrings(allS1Facts);
      allS2Facts = dedupeStrings(allS2Facts);
      const combinedSummary = combinedSummaryFromChunks(allSummaries);

      const conversation: any = await ctx.runQuery(anyApi.conversations.get, {
        id: job.conversationId,
      });
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      const currentUserId = conversation.initiatorUserId as Id<"users">;
      const selectedFriendId =
        job.participantMode === "contact" ? (job.friendId as Id<"users"> | undefined) : undefined;
      if (job.participantMode === "contact" && !selectedFriendId) {
        throw new Error("Friend is required for contact mode");
      }

      const anonymousSpeakerMap = new Map<string, string>();
      const getAnonymousSpeakerLabel = (rawSpeaker: string) => {
        if (!anonymousSpeakerMap.has(rawSpeaker)) {
          const nextSpeakerNumber = anonymousSpeakerMap.size + 2;
          anonymousSpeakerMap.set(rawSpeaker, `Speaker ${nextSpeakerNumber}`);
        }
        return anonymousSpeakerMap.get(rawSpeaker)!;
      };

      const transcriptForSave = allTranscripts.map((turn, turnIndex) => {
        const mappedWords = turn.words.map((word, wordIndex) => ({
          word: word.word,
          startTime: word.startTime,
          endTime: word.endTime,
          wordId: `import-job-t${turnIndex}-w${wordIndex}`,
        }));

        if (job.participantMode === "solo") {
          return {
            userId: currentUserId,
            text: turn.text,
            startTime: turn.startTime,
            words: mappedWords,
          };
        }

        if (job.participantMode === "contact") {
          return {
            userId: turn.speaker === "S1" ? currentUserId : (selectedFriendId as Id<"users">),
            text: turn.text,
            startTime: turn.startTime,
            words: mappedWords,
          };
        }

        if (turn.speaker === "S1") {
          return {
            userId: currentUserId,
            text: turn.text,
            startTime: turn.startTime,
            words: mappedWords,
          };
        }

        return {
          speaker: getAnonymousSpeakerLabel(turn.speaker),
          text: turn.text,
          startTime: turn.startTime,
          words: mappedWords,
        };
      });

      const s1Facts =
        job.participantMode === "solo"
          ? dedupeStrings([...allS1Facts, ...allS2Facts])
          : allS1Facts;
      const s2Facts = job.participantMode === "contact" ? allS2Facts : [];
      const anonymousSpeakerCount = new Set(
        transcriptForSave
          .filter((turn) => !turn.userId && turn.speaker)
          .map((turn) => turn.speaker as string)
      ).size;

      await ctx.runMutation(anyApi.conversations.saveTranscriptDataInternal, {
        conversationId: job.conversationId,
        transcript: transcriptForSave,
        S1_facts: s1Facts,
        S2_facts: s2Facts,
        initiatorName: job.initiatorName || "You",
        scannerName:
          job.participantMode === "contact"
            ? job.scannerName || "Friend"
            : job.participantMode === "solo"
              ? "Self"
              : "Anonymous participant",
        summary: combinedSummary,
        anonymousSpeakerCount: anonymousSpeakerCount > 0 ? anonymousSpeakerCount : undefined,
      });

      await ctx.runMutation(anyApi.importJobs.cleanupChunkResultsInternal, {
        jobId: args.jobId,
      });

      await ctx.runMutation(anyApi.importJobs.markJobCompletedInternal, {
        jobId: args.jobId,
      });
    } catch (error: any) {
      await ctx.runMutation(anyApi.importJobs.markJobFailedInternal, {
        jobId: args.jobId,
        error: `Finalization failed: ${error?.message || "Unknown error"}`,
      });
    }

    return null;
  },
});
