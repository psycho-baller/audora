import { v } from "convex/values";
import { api } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";

// Filler words to detect
const FILLER_WORDS = [
  "um", "uh", "like", "you know", "basically", "actually", "literally",
  "sort of", "kind of", "i mean", "right", "okay", "so", "well"
];

// Weak sentence starters
const WEAK_STARTERS = ["and", "but", "like", "so", "well", "um", "uh"];

// Weak words that could be improved
const WEAK_WORDS = [
  "thing", "stuff", "just", "really", "very", "quite", "pretty",
  "kind of", "sort of", "a bit", "maybe", "probably"
];

const WEAK_WORD_REPLACEMENTS: Record<string, string> = {
  thing: "a specific noun",
  stuff: "specific details",
  just: "remove it",
  really: "a stronger adjective",
  very: "a stronger adjective",
  quite: "a precise qualifier",
  pretty: "a precise qualifier",
  "kind of": "a direct phrase",
  "sort of": "a direct phrase",
  "a bit": "slightly, or a specific amount",
  maybe: "a clear recommendation",
  probably: "likely, with evidence",
};

function normalizeSpeechToken(token: string): string {
  return token.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, "");
}

function getDefaultWeakWordReplacement(word: string): string {
  return WEAK_WORD_REPLACEMENTS[word.toLowerCase()] ?? "a more specific word";
}

function buildWeakWordContext(
  rawWords: string[],
  startPosition: number,
  length: number,
  wordsBefore = 7,
  wordsAfter = 9
): string {
  let start = Math.max(0, startPosition - wordsBefore);
  let end = Math.min(rawWords.length, startPosition + length + wordsAfter);

  for (let index = startPosition - 1; index >= start; index--) {
    if (/[.!?]["')\]]?$/.test(rawWords[index])) {
      start = index + 1;
      break;
    }
  }

  for (let index = startPosition + length - 1; index < end - 1; index++) {
    if (/[.!?]["')\]]?$/.test(rawWords[index])) {
      end = index + 1;
      break;
    }
  }

  const prefix = start > 0 ? "... " : "";
  const suffix = end < rawWords.length ? " ..." : "";
  return `${prefix}${rawWords.slice(start, end).join(" ")}${suffix}`.trim();
}

function getShortContextAroundWeakWord(text: string, word: string, maxLength = 180): string {
  const normalizedText = text.trim().replace(/\s+/g, " ");
  if (normalizedText.length <= maxLength) return normalizedText;

  const wordIndex = normalizedText.toLowerCase().indexOf(word.toLowerCase());
  if (wordIndex === -1) {
    return `${normalizedText.slice(0, maxLength - 3).trimEnd()}...`;
  }

  const targetStart = Math.max(0, wordIndex - Math.floor((maxLength - word.length) / 2));
  const targetEnd = Math.min(normalizedText.length, targetStart + maxLength);
  const start = Math.max(0, targetEnd - maxLength);
  const prefix = start > 0 ? "..." : "";
  const suffix = targetEnd < normalizedText.length ? "..." : "";
  const availableLength = maxLength - prefix.length - suffix.length;
  const snippet = normalizedText.slice(start, start + availableLength).trim();

  return `${prefix}${snippet}${suffix}`;
}

function stripSuggestionDecorations(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

function cleanReplacement(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const replacement = stripSuggestionDecorations(value)
    .replace(/^replace with:?\s*/i, "")
    .trim();

  if (!replacement || replacement.length > 80) return fallback;
  return replacement;
}

function cleanRewrite(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const rewrite = stripSuggestionDecorations(value)
    .replace(/^(try|rewrite|suggestion):\s*/i, "")
    .trim();

  if (!rewrite || rewrite.length > 220) return undefined;

  const sentenceCount = rewrite.split(/[.!?]+/).filter((part) => part.trim().length > 0).length;
  if (sentenceCount > 2 && rewrite.length > 120) return undefined;

  return rewrite;
}

function parseWeakWordSuggestionResponse(
  content: string | undefined,
  weakWord: string
): { replacement: string; suggestion?: string } {
  const fallback = getDefaultWeakWordReplacement(weakWord);
  if (!content) return { replacement: fallback };

  const cleaned = stripSuggestionDecorations(content);
  try {
    const parsed = JSON.parse(cleaned);
    return {
      replacement: cleanReplacement(parsed.replacement, fallback),
      suggestion: cleanRewrite(parsed.rewrite ?? parsed.suggestion),
    };
  } catch {
    return {
      replacement: fallback,
      suggestion: cleanRewrite(cleaned),
    };
  }
}

// Analyze transcript for a specific user
export const analyzeUserSpeech = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    console.log("=== ANALYZE USER SPEECH (BACKEND) ===");
    console.log("Conversation ID:", args.conversationId);
    console.log("User ID:", args.userId);

    // Get all transcript turns for this user in this conversation
    const allTurns = await ctx.db
      .query("transcriptTurns")
      .withIndex("by_conversation_and_order", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    console.log("Total transcript turns found:", allTurns.length);

    // Get conversation for duration and for inferring missing userIds
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      console.log("⚠️ Conversation not found, returning null");
      return null;
    }

    const userTurns = allTurns.filter((turn) => {
      const turnUserId = turn.userId ? String(turn.userId) : null;
      const targetUserId = String(args.userId);
      const initiatorId = String(conversation.initiatorUserId);
      const scannerId = conversation.scannerUserId ? String(conversation.scannerUserId) : null;

      if (turnUserId === targetUserId) return true;

      // Fallback for Mac recordings or older recordings where userId might be missing
      if (!turn.userId) {
        if (turn.speaker === "S1" && initiatorId === targetUserId) return true;
        if (turn.speaker === "S2" && scannerId === targetUserId) return true;
      }
      return false;
    });

    console.log("User turns found:", userTurns.length);

    if (userTurns.length === 0) {
      console.log("⚠️ No turns found for user, returning null");
      return null;
    }

    // Combine all text
    const fullText = userTurns.map((t) => t.text).join(" ");
    const rawWords = fullText.split(/\s+/).filter((word) => word.length > 0);
    const wordEntries = rawWords
      .map((word, position) => ({
        normalized: normalizeSpeechToken(word),
        position,
      }))
      .filter((entry) => entry.normalized.length > 0);
    const words = wordEntries.map((entry) => entry.normalized);
    const wordCount = words.length;

    if (wordCount === 0) {
      console.log("⚠️ User turns have no words, returning null");
      return null;
    }

    const durationMinutes = conversation.startedAt && conversation.endedAt
      ? Math.max(0.1, (conversation.endedAt - conversation.startedAt) / 60000)
      : 1;

    console.log("Word count:", wordCount);
    console.log("Duration (minutes):", durationMinutes);

    // 1. Filler Word Detection
    const fillerInstances: Array<{ word: string; position: number }> = [];
    words.forEach((word, index) => {
      if (FILLER_WORDS.includes(word)) {
        fillerInstances.push({ word, position: index });
      }
    });

    console.log("Filler words found:", fillerInstances.length);

    // Collect all words with timing from user turns FIRST (needed for accurate WPM)
    const allWordsWithTiming: Array<{ word: string; startTime: number; endTime: number }> = [];

    // Debug: Check what data is in the turns
    console.log("Checking user turns for word-level timing:");
    userTurns.forEach((turn, idx) => {
      console.log(`Turn ${idx}: has words=${!!turn.words}, words length=${turn.words?.length || 0}`);
      if (turn.words && turn.words.length > 0) {
        console.log(`  First word sample:`, turn.words[0]);
      }
    });

    userTurns.forEach((turn) => {
      if (turn.words && Array.isArray(turn.words)) {
        turn.words.forEach((w) => {
          allWordsWithTiming.push({
            word: w.word,
            startTime: w.startTime,
            endTime: w.endTime,
          });
        });
      }
    });

    console.log(`Total words with timing collected: ${allWordsWithTiming.length}`);

    // 2. Pacing Metrics - Calculate user's ACTUAL speaking duration, not total conversation time
    let userSpeakingDurationMinutes: number;

    if (allWordsWithTiming.length > 0) {
      // ACCURATE METHOD: Use word-level timing to get actual speaking duration
      // Sort by start time first
      allWordsWithTiming.sort((a, b) => a.startTime - b.startTime);

      // Calculate total speaking time by summing up each word's duration
      // This excludes pauses between words and time spent listening
      let totalSpeakingSeconds = 0;

      // Method 1: Sum individual word durations (most accurate)
      allWordsWithTiming.forEach((w) => {
        totalSpeakingSeconds += (w.endTime - w.startTime);
      });

      // If word durations are suspiciously short/zero, fall back to span method
      if (totalSpeakingSeconds < 1 && allWordsWithTiming.length > 10) {
        // Method 2: Use time span from first to last word, minus gaps > 2 seconds
        let speakingSpan = 0;
        for (let i = 0; i < allWordsWithTiming.length - 1; i++) {
          const gap = allWordsWithTiming[i + 1].startTime - allWordsWithTiming[i].endTime;
          const wordDuration = allWordsWithTiming[i].endTime - allWordsWithTiming[i].startTime;
          speakingSpan += wordDuration;
          // Only count gaps under 2 seconds as part of speaking (natural pauses)
          if (gap < 2) {
            speakingSpan += gap;
          }
        }
        // Add last word duration
        const lastWord = allWordsWithTiming[allWordsWithTiming.length - 1];
        speakingSpan += (lastWord.endTime - lastWord.startTime);
        totalSpeakingSeconds = speakingSpan;
      }

      userSpeakingDurationMinutes = Math.max(totalSpeakingSeconds / 60, 0.1); // Min 6 seconds
      console.log(`User speaking duration (from word timing): ${totalSpeakingSeconds.toFixed(1)}s = ${userSpeakingDurationMinutes.toFixed(2)} minutes`);
    } else {
      // FALLBACK: Estimate based on proportion of words spoken
      // If user spoke 40% of words, assume they spoke for ~40% of the time
      const totalTurns = await ctx.db
        .query("transcriptTurns")
        .withIndex("by_conversation_and_order", (q) =>
          q.eq("conversationId", args.conversationId)
        )
        .collect();

      const totalWordsInConvo = totalTurns.reduce((sum, t) => sum + t.text.split(/\s+/).filter(Boolean).length, 0);
      const userWordRatio = totalWordsInConvo > 0 ? wordCount / totalWordsInConvo : 0.5;
      userSpeakingDurationMinutes = Math.max(durationMinutes * userWordRatio, 0.1);
      console.log(`User speaking duration (estimated from word ratio ${(userWordRatio * 100).toFixed(0)}%): ${userSpeakingDurationMinutes.toFixed(2)} minutes`);
    }

    const wordsPerMinute = Math.round(wordCount / userSpeakingDurationMinutes);
    console.log(`Words per minute: ${wordsPerMinute} (${wordCount} words / ${userSpeakingDurationMinutes.toFixed(2)} min)`);

    // Calculate pacing segments from word-level timing data
    const durationSeconds = durationMinutes * 60;
    const pacingSegments: Array<{ startTime: number; endTime: number; wpm: number }> = [];

    // If we have word-level timing, compute segments (array already sorted above)
    if (allWordsWithTiming.length > 0) {

      // Determine segment size (aim for ~10-20 segments)
      const totalDuration = allWordsWithTiming[allWordsWithTiming.length - 1].endTime - allWordsWithTiming[0].startTime;
      const segmentDuration = Math.max(5, totalDuration / 15); // At least 5 seconds per segment

      let segmentStart = allWordsWithTiming[0].startTime;
      while (segmentStart < allWordsWithTiming[allWordsWithTiming.length - 1].endTime) {
        const segmentEnd = segmentStart + segmentDuration;
        const wordsInSegment = allWordsWithTiming.filter(
          (w) => w.startTime >= segmentStart && w.startTime < segmentEnd
        );

        if (wordsInSegment.length > 0) {
          const segmentWpm = Math.round((wordsInSegment.length / segmentDuration) * 60);
          pacingSegments.push({
            startTime: segmentStart,
            endTime: segmentEnd,
            wpm: segmentWpm,
          });
        }
        segmentStart = segmentEnd;
      }

      console.log(`Computed ${pacingSegments.length} pacing segments from ${allWordsWithTiming.length} words`);
    } else {
      console.log("No word-level timing data available for pacing segments");
    }

    // 3. Repetition Detection
    const wordFrequency: Record<string, number> = {};
    const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for"]);

    words.forEach((word) => {
      if (!stopWords.has(word) && word.length > 3) {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    });

    const repeatedWords = Object.entries(wordFrequency)
      .filter(([_, count]) => count >= 3)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Detect repeated phrases (2-3 word sequences)
    const phrases: Record<string, number> = {};
    for (let i = 0; i < words.length - 1; i++) {
      const twoWordPhrase = `${words[i]} ${words[i + 1]}`;
      if (!stopWords.has(words[i]) || !stopWords.has(words[i + 1])) {
        phrases[twoWordPhrase] = (phrases[twoWordPhrase] || 0) + 1;
      }
    }

    const repeatedPhrases = Object.entries(phrases)
      .filter(([_, count]) => count >= 2)
      .map(([phrase, count]) => ({ phrase, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 4. Sentence Starter Analysis
    const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let weakStarterCount = 0;
    const weakStarterFreq: Record<string, number> = {};

    sentences.forEach((sentence) => {
      const firstWord = sentence.trim().toLowerCase().split(/\s+/)[0];
      if (WEAK_STARTERS.includes(firstWord)) {
        weakStarterCount++;
        weakStarterFreq[firstWord] = (weakStarterFreq[firstWord] || 0) + 1;
      }
    });

    const weakStarters = Object.entries(weakStarterFreq).map(([word, count]) => ({
      word,
      count,
    }));

    // 5. Weak Word Detection
    const weakWordInstances: Array<{
      word: string;
      sentence: string;
      position: number;
      startTime?: number;
      endTime?: number;
      replacement: string;
    }> = [];
    const weakWordPatterns = WEAK_WORDS.map((weakWord) => ({
      word: weakWord,
      tokens: weakWord.split(/\s+/).map(normalizeSpeechToken),
    })).sort((a, b) => b.tokens.length - a.tokens.length);

    for (let index = 0; index < wordEntries.length; index++) {
      for (const pattern of weakWordPatterns) {
        const isMatch = pattern.tokens.every(
          (token, offset) => wordEntries[index + offset]?.normalized === token
        );

        if (!isMatch) continue;

        const startPosition = wordEntries[index].position;
        const endPosition = wordEntries[index + pattern.tokens.length - 1].position;
        const startTiming = allWordsWithTiming[startPosition];
        const endTiming = allWordsWithTiming[endPosition];

        weakWordInstances.push({
          word: pattern.word,
          sentence: buildWeakWordContext(rawWords, startPosition, endPosition - startPosition + 1),
          position: startPosition,
          startTime: startTiming?.startTime,
          endTime: endTiming?.endTime,
          replacement: getDefaultWeakWordReplacement(pattern.word),
        });
        break;
      }
    }

    // 6. Calculate Scores (0-100)
    const fillerRate = wordCount > 0 ? (fillerInstances.length / wordCount) * 100 : 0;
    const clarityScore = Math.max(0, Math.min(100, 100 - fillerRate * 10));

    const repetitionRate = wordCount > 0 ? repeatedWords.reduce((sum, w) => sum + w.count, 0) / wordCount : 0;
    const concisenessScore = Math.max(0, Math.min(100, 100 - repetitionRate * 50));

    const weakStarterRate = sentences.length > 0 ? weakStarterCount / sentences.length : 0;
    const confidenceScore = Math.max(0, Math.min(100, 100 - weakStarterRate * 100));

    // Store analytics
    const existing = await ctx.db
      .query("speechAnalytics")
      .withIndex("by_user_and_conversation", (q) =>
        q.eq("userId", args.userId).eq("conversationId", args.conversationId)
      )
      .first();

    console.log("Existing analytics:", existing ? "Found" : "Not found");
    console.log("Repeated words:", repeatedWords.length);
    console.log("Repeated phrases:", repeatedPhrases.length);
    console.log("Weak starters:", weakStarters.length);
    console.log("Weak words:", weakWordInstances.length);
    console.log("Scores - Clarity:", Math.round(clarityScore), "Conciseness:", Math.round(concisenessScore), "Confidence:", Math.round(confidenceScore));

    const analyticsData = {
      conversationId: args.conversationId,
      userId: args.userId,
      fillerWords: {
        count: fillerInstances.length,
        ratePerMinute: fillerInstances.length / durationMinutes,
        instances: fillerInstances.slice(0, 20), // Limit to 20
      },
      pacing: {
        wordsPerMinute,
        averagePauseDuration: undefined,
        longestPause: undefined,
        durationSeconds,
        segments: pacingSegments.length > 0 ? pacingSegments : undefined,
      },
      repetitions: {
        repeatedWords,
        repeatedPhrases,
      },
      sentenceStarters: {
        total: sentences.length,
        weak: weakStarters,
      },
      weakWords: weakWordInstances.slice(0, 10).map(w => ({
        ...w,
        suggestion: undefined,
      })),
      scores: {
        clarity: Math.round(clarityScore),
        conciseness: Math.round(concisenessScore),
        confidence: Math.round(confidenceScore),
      },
    };

    if (existing) {
      console.log("Updating existing analytics:", existing._id);
      await ctx.db.patch(existing._id, analyticsData);
      console.log("✅ Analytics updated successfully");
      return existing._id;
    } else {
      console.log("Creating new analytics entry");
      const id = await ctx.db.insert("speechAnalytics", analyticsData);
      console.log("✅ Analytics created with ID:", id);
      return id;
    }
  },
});

// Get analytics for a user in a conversation
export const getAnalytics = query({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const analytics = await ctx.db
      .query("speechAnalytics")
      .withIndex("by_user_and_conversation", (q) =>
        q.eq("userId", args.userId).eq("conversationId", args.conversationId)
      )
      .first();

    return analytics;
  },
});

// Get all analytics for a conversation
export const getConversationAnalytics = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const analytics = await ctx.db
      .query("speechAnalytics")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    return analytics;
  },
});

// Get user's analytics history (for trend tracking)
export const getUserAnalyticsHistory = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const analytics = await ctx.db
      .query("speechAnalytics")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit || 10);

    return analytics;
  },
});

// Generate AI suggestions for weak words (using OpenAI)
export const generateWeakWordSuggestions = action({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    console.log("=== GENERATE AI SUGGESTIONS (BACKEND) ===");
    console.log("Conversation ID:", args.conversationId);
    console.log("User ID:", args.userId);

    const analytics = await ctx.runQuery(api.analytics.getAnalytics, args);

    console.log("Analytics found:", analytics ? "Yes" : "No");
    console.log("Weak words count:", analytics?.weakWords?.length || 0);

    if (!analytics || analytics.weakWords.length === 0) {
      console.log("⚠️ No analytics or weak words, returning");
      return;
    }

    // Get OpenAI suggestions for weak sentences
    const suggestions: Array<{
      word: string;
      sentence: string;
      position?: number;
      startTime?: number;
      endTime?: number;
      replacement?: string;
      suggestion?: string;
    }> = [];

    for (const weakWord of analytics.weakWords.slice(0, 5)) {
      console.log("Generating suggestion for:", weakWord.word);
      const context = getShortContextAroundWeakWord(weakWord.sentence, weakWord.word);
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: [
                  "You are a communication coach.",
                  "For a weak word, suggest a concise replacement and a short rewrite of only the local context.",
                  "Return JSON only with keys replacement and rewrite.",
                  "replacement must be 1-5 words and replace only the weak word or phrase. Use \"remove it\" when deletion is best.",
                  "rewrite must stay under 25 words and must not add facts.",
                ].join(" "),
              },
              {
                role: "user",
                content: `Weak word: "${weakWord.word}"\nLocal context: "${context}"`,
              },
            ],
            max_tokens: 120,
            temperature: 0.2,
          }),
        });

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        const parsedSuggestion = parseWeakWordSuggestionResponse(content, weakWord.word);

        console.log("OpenAI response:", data);
        console.log("Suggestion:", parsedSuggestion);

        suggestions.push({
          ...weakWord,
          replacement: parsedSuggestion.replacement,
          suggestion: parsedSuggestion.suggestion,
        });
      } catch (error) {
        console.error("❌ Error generating suggestion:", error);
        suggestions.push({
          ...weakWord,
          replacement: getDefaultWeakWordReplacement(weakWord.word),
        });
      }
    }

    console.log("Total suggestions generated:", suggestions.length);

    // Update analytics with suggestions
    if (suggestions.length > 0) {
      console.log("Updating analytics with suggestions...");
      const existingAnalytics = await ctx.runQuery(api.analytics.getAnalytics, args);
      if (existingAnalytics) {
        const updatedWeakWords = existingAnalytics.weakWords.map((ww: {
          word: string;
          sentence: string;
          position?: number;
          startTime?: number;
          endTime?: number;
          replacement?: string;
          suggestion?: string;
        }) => {
          const suggestion = suggestions.find(
            (s) =>
              s.word === ww.word &&
              ((s.position !== undefined && ww.position !== undefined && s.position === ww.position) ||
                s.sentence === ww.sentence)
          );
          return suggestion
            ? {
                ...ww,
                replacement: suggestion.replacement ?? ww.replacement,
                suggestion: suggestion.suggestion ?? ww.suggestion,
              }
            : {
                ...ww,
                replacement: ww.replacement ?? getDefaultWeakWordReplacement(ww.word),
              };
        });

        await ctx.runMutation(api.analytics.updateWeakWordSuggestions, {
          analyticsId: existingAnalytics._id,
          weakWords: updatedWeakWords,
        });
        console.log("✅ Analytics updated with suggestions");
      }
    } else {
      console.log("ℹ️ No suggestions to update");
    }

    console.log("=== SUGGESTIONS COMPLETE ===");
    return suggestions;
  },
});

// Helper mutation to update weak word suggestions
export const updateWeakWordSuggestions = mutation({
  args: {
    analyticsId: v.id("speechAnalytics"),
    weakWords: v.array(v.object({
      word: v.string(),
      sentence: v.string(),
      position: v.optional(v.number()),
      startTime: v.optional(v.number()),
      endTime: v.optional(v.number()),
      replacement: v.optional(v.string()),
      suggestion: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.analyticsId, {
      weakWords: args.weakWords,
    });
  },
});

// Get comprehensive dashboard data for current user
export const getUserDashboard = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier.split("|")[1])
      )
      .unique();

    if (!user) {
      return null;
    }

    // Get all conversations
    const conversationsAsInitiator = await ctx.db
      .query("conversations")
      .withIndex("by_initiator", (q) => q.eq("initiatorUserId", user._id))
      .filter((q) => q.neq(q.field("status"), "pending"))
      .collect();

    const conversationsAsScanner = await ctx.db
      .query("conversations")
      .withIndex("by_scanner", (q) => q.eq("scannerUserId", user._id))
      .filter((q) => q.neq(q.field("status"), "pending"))
      .collect();

    const allConversations = [...conversationsAsInitiator, ...conversationsAsScanner]
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

    // Get all analytics for user
    const allAnalytics = await ctx.db
      .query("speechAnalytics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const conversationsById = new Map(
      allConversations.map((conversation) => [conversation._id, conversation])
    );
    const getConversationTime = (conversationId: typeof allAnalytics[number]["conversationId"]) => {
      const conversation = conversationsById.get(conversationId);
      return conversation?.endedAt ?? conversation?.startedAt ?? conversation?._creationTime ?? 0;
    };
    const analyticsByConversationTime = allAnalytics
      .map((analytics) => ({
        analytics,
        time: getConversationTime(analytics.conversationId) || analytics._creationTime,
      }))
      .sort((a, b) => a.time - b.time);

    // Calculate aggregate stats
    const totalConversations = allConversations.length;
    const completedConversations = allConversations.filter(c => c.status === "ended").length;
    const totalFillerWords = allAnalytics.reduce((sum, a) => sum + a.fillerWords.count, 0);
    const totalWeakWords = allAnalytics.reduce((sum, a) => sum + a.weakWords.length, 0);
    const totalRepeatedWords = allAnalytics.reduce(
      (sum, a) => sum + a.repetitions.repeatedWords.reduce((wordSum, word) => wordSum + word.count, 0),
      0
    );
    const totalRepeatedPhrases = allAnalytics.reduce(
      (sum, a) => sum + a.repetitions.repeatedPhrases.reduce((phraseSum, phrase) => phraseSum + phrase.count, 0),
      0
    );
    const totalWeakStarters = allAnalytics.reduce(
      (sum, a) => sum + a.sentenceStarters.weak.reduce((starterSum, starter) => starterSum + starter.count, 0),
      0
    );

    // Average scores
    const avgClarity = allAnalytics.length > 0
      ? Math.round(allAnalytics.reduce((sum, a) => sum + a.scores.clarity, 0) / allAnalytics.length)
      : 0;
    const avgConciseness = allAnalytics.length > 0
      ? Math.round(allAnalytics.reduce((sum, a) => sum + a.scores.conciseness, 0) / allAnalytics.length)
      : 0;
    const avgConfidence = allAnalytics.length > 0
      ? Math.round(allAnalytics.reduce((sum, a) => sum + a.scores.confidence, 0) / allAnalytics.length)
      : 0;
    const avgFillerRate = allAnalytics.length > 0
      ? Math.round((allAnalytics.reduce((sum, a) => sum + a.fillerWords.ratePerMinute, 0) / allAnalytics.length) * 10) / 10
      : 0;
    const avgWordsPerMinute = allAnalytics.length > 0
      ? Math.round(allAnalytics.reduce((sum, a) => sum + a.pacing.wordsPerMinute, 0) / allAnalytics.length)
      : 0;

    // Total speaking time and words
    let totalWords = 0;
    let totalMinutes = 0;
    for (const conv of allConversations) {
      if (conv.startedAt && conv.endedAt) {
        totalMinutes += (conv.endedAt - conv.startedAt) / 60000;
      }
      const turns = await ctx.db
        .query("transcriptTurns")
        .withIndex("by_conversation_and_user", (q) =>
          q.eq("conversationId", conv._id).eq("userId", user._id)
        )
        .collect();
      totalWords += turns.reduce((sum, t) => sum + t.text.split(/\s+/).filter(Boolean).length, 0);
    }

    // Recent performance trend (last 10 conversations)
    const recentAnalytics = analyticsByConversationTime.slice(-10);
    const performanceTrend = recentAnalytics.map(({ analytics: a }, idx) => ({
      conversation: idx + 1,
      clarity: a.scores.clarity,
      conciseness: a.scores.conciseness,
      confidence: a.scores.confidence,
    }));

    // Top repeated words across all conversations
    const allFacts = await ctx.db
      .query("conversationFacts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const wordFrequency: Record<string, number> = {};
    allFacts.forEach(cf => {
      cf.facts.forEach(fact => {
        const words = fact.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        words.forEach(word => {
          wordFrequency[word] = (wordFrequency[word] || 0) + 1;
        });
      });
    });

    const topKeywords = Object.entries(wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    // Filler word trends
    const fillerTrend = recentAnalytics.map(({ analytics: a }, idx) => ({
      conversation: idx + 1,
      count: a.fillerWords.count,
      rate: Math.round(a.fillerWords.ratePerMinute * 10) / 10,
    }));

    return {
      overview: {
        totalConversations,
        completedConversations,
        totalWords,
        totalMinutes: Math.round(totalMinutes),
        avgClarity,
        avgConciseness,
        avgConfidence,
        avgFillerRate,
        avgWordsPerMinute,
        totalFillerWords,
        totalWeakWords,
        totalRepeatedWords,
        totalRepeatedPhrases,
        totalWeakStarters,
      },
      performanceTrend,
      fillerTrend,
      topKeywords,
      recentConversations: allConversations.slice(0, 10).map(c => ({
        id: c._id,
        location: c.location,
        startedAt: c.startedAt,
        endedAt: c.endedAt,
        status: c.status,
      })),
    };
  },
});

export const getWeeklyProgress = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const tokenIdentifier = identity.tokenIdentifier.split("|")[1] ?? identity.subject;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();

    if (!user) {
      return null;
    }

    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const currentStart = now - weekMs;
    const previousStart = currentStart - weekMs;

    const conversationsAsInitiator = await ctx.db
      .query("conversations")
      .withIndex("by_initiator", (q) => q.eq("initiatorUserId", user._id))
      .filter((q) => q.neq(q.field("status"), "pending"))
      .collect();

    const conversationsAsScanner = await ctx.db
      .query("conversations")
      .withIndex("by_scanner", (q) => q.eq("scannerUserId", user._id))
      .filter((q) => q.neq(q.field("status"), "pending"))
      .collect();

    const conversationMap = new Map(
      [...conversationsAsInitiator, ...conversationsAsScanner].map((conversation) => [
        conversation._id,
        conversation,
      ])
    );

    const allConversations = Array.from(conversationMap.values());
    const getConversationTime = (conversation: typeof allConversations[number]) =>
      conversation.endedAt ?? conversation.startedAt ?? conversation._creationTime;

    const currentConversations = allConversations.filter((conversation) => {
      const time = getConversationTime(conversation);
      return time >= currentStart && time <= now;
    });

    const previousConversations = allConversations.filter((conversation) => {
      const time = getConversationTime(conversation);
      return time >= previousStart && time < currentStart;
    });

    const allAnalytics = await ctx.db
      .query("speechAnalytics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const analyticsWithTimes = await Promise.all(
      allAnalytics.map(async (analytics) => {
        const conversation =
          conversationMap.get(analytics.conversationId) ??
          (await ctx.db.get(analytics.conversationId));

        return {
          analytics,
          time: conversation
            ? conversation.endedAt ?? conversation.startedAt ?? conversation._creationTime
            : analytics._creationTime,
        };
      })
    );

    const currentAnalytics = analyticsWithTimes
      .filter(({ time }) => time >= currentStart && time <= now)
      .map(({ analytics }) => analytics);

    const previousAnalytics = analyticsWithTimes
      .filter(({ time }) => time >= previousStart && time < currentStart)
      .map(({ analytics }) => analytics);

    const average = (values: number[]) =>
      values.length > 0
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : null;

    const percentageChange = (current: number | null, previous: number | null) => {
      if (current === null || previous === null || previous === 0) return null;
      return Math.round(((current - previous) / previous) * 100);
    };

    const currentConfidence = average(
      currentAnalytics.map((analytics) => analytics.scores.confidence)
    );
    const previousConfidence = average(
      previousAnalytics.map((analytics) => analytics.scores.confidence)
    );

    const currentFillerRate = average(
      currentAnalytics.map((analytics) => analytics.fillerWords.ratePerMinute)
    );
    const previousFillerRate = average(
      previousAnalytics.map((analytics) => analytics.fillerWords.ratePerMinute)
    );

    return {
      conversations: {
        current: currentConversations.length,
        previous: previousConversations.length,
        change: currentConversations.length - previousConversations.length,
      },
      confidence: {
        current: currentConfidence === null ? null : Math.round(currentConfidence),
        previous: previousConfidence === null ? null : Math.round(previousConfidence),
        changePercent: percentageChange(currentConfidence, previousConfidence),
      },
      fillerWords: {
        currentRate:
          currentFillerRate === null ? null : Math.round(currentFillerRate * 10) / 10,
        previousRate:
          previousFillerRate === null ? null : Math.round(previousFillerRate * 10) / 10,
        reductionPercent:
          currentFillerRate === null || previousFillerRate === null || previousFillerRate === 0
            ? null
            : Math.round(((previousFillerRate - currentFillerRate) / previousFillerRate) * 100),
      },
    };
  },
});

// Get personalized feedback for a conversation
export const getPersonalizedFeedback = query({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db
      .query("personalizedFeedback")
      .withIndex("by_conversation_and_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", args.userId)
      )
      .first();

    return feedback;
  },
});

// Generate personalized feedback using AI
export const generatePersonalizedFeedback = action({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    console.log("=== GENERATE PERSONALIZED FEEDBACK ===");

    // Get analytics for this conversation
    let analytics = await ctx.runQuery(api.analytics.getAnalytics, args);
    if (!analytics) {
      console.log("No analytics found, attempting to analyze first...");
      await ctx.runMutation(api.analytics.analyzeUserSpeech, args);
      analytics = await ctx.runQuery(api.analytics.getAnalytics, args);
    }

    if (!analytics) {
      console.log("No analytics found after analysis attempt");
      return null;
    }

    // Get transcript
    const transcript = await ctx.runQuery(api.conversations.getTranscript, {
      conversationId: args.conversationId,
    });

    // Get user's previous analytics for comparison
    const allUserAnalytics = await ctx.runQuery(api.analytics.getConversationAnalytics, {
      conversationId: args.conversationId,
    });

    const userAnalytics = allUserAnalytics?.filter(a => a.userId === args.userId) || [];

    // Prepare context for AI
    const context = {
      currentAnalytics: {
        fillerWordsCount: analytics.fillerWords.count,
        fillerWordsRate: analytics.fillerWords.ratePerMinute,
        wordsPerMinute: analytics.pacing.wordsPerMinute,
        clarityScore: analytics.scores.clarity,
        concisenessScore: analytics.scores.conciseness,
        confidenceScore: analytics.scores.confidence,
        weakWords: analytics.weakWords.length,
        repeatedWords: analytics.repetitions.repeatedWords.length,
      },
      transcriptSample: transcript?.slice(0, 5).map(t => t.text).join(" "),
    };

    // Call OpenAI for personalized feedback
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("OpenAI API key not found");
      return null;
    }

    const prompt = `You are an expert communication coach analyzing a speech performance. Based on the following metrics, provide personalized, actionable feedback:

Current Performance:
- Filler words: ${context.currentAnalytics.fillerWordsCount} (${context.currentAnalytics.fillerWordsRate.toFixed(1)} per minute)
- Speaking pace: ${context.currentAnalytics.wordsPerMinute} words per minute
- Clarity score: ${context.currentAnalytics.clarityScore}/100
- Conciseness score: ${context.currentAnalytics.concisenessScore}/100
- Confidence score: ${context.currentAnalytics.confidenceScore}/100
- Weak words identified: ${context.currentAnalytics.weakWords}
- Repeated words: ${context.currentAnalytics.repeatedWords}

Transcript sample: "${context.transcriptSample}"

Provide feedback in the following JSON format:
{
  "summary": "A 2-3 sentence overall assessment of their communication",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": ["area 1", "area 2", "area 3"],
  "actionItems": ["specific action 1", "specific action 2", "specific action 3"]
}

Make the feedback:
1. Specific and actionable
2. Encouraging but honest
3. Focused on the most impactful improvements
4. Professional and supportive in tone`;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are an expert communication coach providing personalized feedback on speech performance.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        console.error("OpenAI API error:", response.status, await response.text());
        return null;
      }

      const data = await response.json();
      const feedbackText = data.choices[0].message.content;
      const feedback = JSON.parse(feedbackText);

      // Save feedback to database
      const existingFeedback = await ctx.runQuery(api.analytics.getPersonalizedFeedback, args);

      const feedbackData = {
        conversationId: args.conversationId,
        userId: args.userId,
        summary: feedback.summary,
        strengths: feedback.strengths || [],
        improvements: feedback.improvements || [],
        actionItems: feedback.actionItems || [],
        comparisonToPrevious: undefined,
        generatedAt: Date.now(),
      };

      if (existingFeedback) {
        await ctx.runMutation(api.analytics.updatePersonalizedFeedback, {
          feedbackId: existingFeedback._id,
          ...feedbackData,
        });
      } else {
        await ctx.runMutation(api.analytics.createPersonalizedFeedback, feedbackData);
      }

      console.log("✅ Personalized feedback generated");
      return feedback;
    } catch (error) {
      console.error("Error generating feedback:", error);
      return null;
    }
  },
});

// Create personalized feedback
export const createPersonalizedFeedback = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    summary: v.string(),
    strengths: v.array(v.string()),
    improvements: v.array(v.string()),
    actionItems: v.array(v.string()),
    comparisonToPrevious: v.optional(v.string()),
    generatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("personalizedFeedback", args);
  },
});

// Update personalized feedback
export const updatePersonalizedFeedback = mutation({
  args: {
    feedbackId: v.id("personalizedFeedback"),
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    summary: v.string(),
    strengths: v.array(v.string()),
    improvements: v.array(v.string()),
    actionItems: v.array(v.string()),
    comparisonToPrevious: v.optional(v.string()),
    generatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { feedbackId, ...data } = args;
    await ctx.db.patch(feedbackId, data);
  },
});
