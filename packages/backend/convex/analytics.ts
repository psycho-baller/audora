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
    console.log("User IDs in transcript:", Array.from(new Set(allTurns.map(t => t.userId))));

    const userTurns = allTurns.filter((turn) => turn.userId === args.userId);
    console.log("User turns found:", userTurns.length);

    if (userTurns.length === 0) {
      console.log("⚠️ No turns found for user, returning null");
      return null;
    }

    // Combine all text
    const fullText = userTurns.map((t) => t.text).join(" ");
    const words = fullText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    // Get conversation duration
    const conversation = await ctx.db.get(args.conversationId);
    const durationMinutes = conversation?.startedAt && conversation?.endedAt
      ? (conversation.endedAt - conversation.startedAt) / 60000
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

      const totalWordsInConvo = totalTurns.reduce((sum, t) => sum + t.text.split(/\s+/).length, 0);
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
    const weakWordInstances: Array<{ word: string; sentence: string }> = [];
    sentences.forEach((sentence) => {
      const lowerSentence = sentence.toLowerCase();
      WEAK_WORDS.forEach((weakWord) => {
        if (lowerSentence.includes(weakWord)) {
          weakWordInstances.push({
            word: weakWord,
            sentence: sentence.trim(),
          });
        }
      });
    });

    // 6. Calculate Scores (0-100)
    const fillerRate = (fillerInstances.length / wordCount) * 100;
    const clarityScore = Math.max(0, Math.min(100, 100 - fillerRate * 10));

    const repetitionRate = repeatedWords.reduce((sum, w) => sum + w.count, 0) / wordCount;
    const concisenessScore = Math.max(0, Math.min(100, 100 - repetitionRate * 50));

    const weakStarterRate = weakStarterCount / sentences.length;
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
    const suggestions: Array<{ word: string; sentence: string; suggestion: string }> = [];

    for (const weakWord of analytics.weakWords.slice(0, 5)) {
      console.log("Generating suggestion for:", weakWord.word);
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
                content: "You are a communication coach. Rewrite sentences to be more clear and confident by replacing weak words. Keep the meaning the same but make it stronger.",
              },
              {
                role: "user",
                content: `Improve this sentence by removing the weak word "${weakWord.word}":\n\n"${weakWord.sentence}"`,
              },
            ],
            max_tokens: 100,
            temperature: 0.7,
          }),
        });

        const data = await response.json();
        const suggestion = data.choices?.[0]?.message?.content?.trim();

        console.log("OpenAI response:", data);
        console.log("Suggestion:", suggestion);

        if (suggestion) {
          suggestions.push({
            ...weakWord,
            suggestion,
          });
        }
      } catch (error) {
        console.error("❌ Error generating suggestion:", error);
      }
    }

    console.log("Total suggestions generated:", suggestions.length);

    // Update analytics with suggestions
    if (suggestions.length > 0) {
      console.log("Updating analytics with suggestions...");
      const existingAnalytics = await ctx.runQuery(api.analytics.getAnalytics, args);
      if (existingAnalytics) {
        const updatedWeakWords = existingAnalytics.weakWords.map((ww: { word: string; sentence: string; suggestion?: string }) => {
          const suggestion = suggestions.find(
            (s) => s.word === ww.word && s.sentence === ww.sentence
          );
          return suggestion || ww;
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

    // Calculate aggregate stats
    const totalConversations = allConversations.length;
    const completedConversations = allConversations.filter(c => c.status === "ended").length;

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
      totalWords += turns.reduce((sum, t) => sum + t.text.split(/\s+/).length, 0);
    }

    // Recent performance trend (last 10 conversations)
    const recentAnalytics = allAnalytics.slice(0, 10).reverse();
    const performanceTrend = recentAnalytics.map((a, idx) => ({
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
    const fillerTrend = allAnalytics.slice(0, 10).reverse().map((a, idx) => ({
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
    const analytics = await ctx.runQuery(api.analytics.getAnalytics, args);
    if (!analytics) {
      console.log("No analytics found");
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