import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { paymentWebhook } from "./subscriptions";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://www.getaudora.app",
  "https://linkmaxxeng.netlify.app",
];

function getAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null;

  const configuredOrigin = process.env.FRONTEND_URL?.trim();
  const allowedOrigins = new Set(DEFAULT_ALLOWED_ORIGINS);

  if (configuredOrigin) {
    allowedOrigins.add(configuredOrigin);
  }

  return allowedOrigins.has(origin) ? origin : null;
}

function buildCorsHeaders(origin: string | null, methods: string): HeadersInit {
  const allowedOrigin = getAllowedOrigin(origin);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    Vary: "origin",
  };

  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }

  return headers;
}

// Helper to format seconds into MM:SS or HH:MM:SS
function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export const chat = httpAction(async (ctx, req) => {
  const origin = req.headers.get("Origin");
  const allowedOrigin = getAllowedOrigin(origin);

  if (origin && !allowedOrigin) {
    return new Response("Origin not allowed", { status: 403 });
  }

  // Extract the `messages` and optional `conversationId` from the body of the request
  const { messages, conversationId } = await req.json();

  // Get user identity from auth
  const identity = await ctx.auth.getUserIdentity();

  let conversationContext = "";
  let isConversationSpecific = false;

  if (identity) {
    try {
      if (conversationId) {
        // === CONVERSATION-SPECIFIC MODE ===
        // Load detailed analytics for ONE recorded conversation
        isConversationSpecific = true;

        const conversation = await ctx.runQuery(api.conversations.get, {
          id: conversationId as Id<"conversations">
        });

        if (!conversation) {
          throw new Error("Conversation not found");
        }

        const transcript = await ctx.runQuery(api.conversations.getTranscript, {
          conversationId: conversationId as Id<"conversations">
        });

        const facts = await ctx.runQuery(api.conversations.getFacts, {
          conversationId: conversationId as Id<"conversations">
        });

        // Fetch analytics for all speakers in this conversation
        const analytics = await ctx.runQuery(api.analytics.getConversationAnalytics, {
          conversationId: conversationId as Id<"conversations">
        });

        conversationContext = `\n\n## RECORDED CONVERSATION DETAILS\n`;
        conversationContext += `Date: ${new Date(conversation._creationTime).toLocaleDateString()}\n`;
        conversationContext += `Status: ${conversation.status}\n`;
        if (conversation.location) conversationContext += `Context: ${conversation.location}\n`;
        if (conversation.summary) conversationContext += `Summary: ${conversation.summary}\n\n`;

        // Add analytics data
        if (analytics && analytics.length > 0) {
          conversationContext += `## SPEECH ANALYTICS\n`;
          for (const analytic of analytics) {
            conversationContext += `\nSpeaker (${analytic.userId}):\n`;
            conversationContext += `- Filler words: ${analytic.fillerWords.count} instances (${analytic.fillerWords.ratePerMinute.toFixed(1)}/min)\n`;
            if (analytic.fillerWords.instances && analytic.fillerWords.instances.length > 0) {
              const fillerSummary = analytic.fillerWords.instances
                .reduce((acc: Record<string, number>, inst: { word: string }) => {
                  acc[inst.word] = (acc[inst.word] || 0) + 1;
                  return acc;
                }, {});
              const topFillers = Object.entries(fillerSummary)
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .slice(0, 5)
                .map(([word, count]) => `"${word}" (${count}×)`)
                .join(', ');
              conversationContext += `  Most common: ${topFillers}\n`;
            }
            conversationContext += `- Speaking pace: ${analytic.pacing.wordsPerMinute} WPM\n`;
            if (analytic.pacing.averagePauseDuration) {
              conversationContext += `- Average pause duration: ${analytic.pacing.averagePauseDuration.toFixed(2)}s\n`;
            }
            if (analytic.pacing.longestPause) {
              conversationContext += `- Longest pause: ${analytic.pacing.longestPause.toFixed(2)}s\n`;
            }
            conversationContext += `- Clarity score: ${analytic.scores.clarity}/100\n`;
            conversationContext += `- Confidence score: ${analytic.scores.confidence}/100\n`;
            conversationContext += `- Conciseness score: ${analytic.scores.conciseness}/100\n`;
            
            // Add weak words if any
            if (analytic.weakWords && analytic.weakWords.length > 0) {
              conversationContext += `- Weak words detected: ${analytic.weakWords.slice(0, 5).map((w: { word: string }) => `"${w.word}"`).join(', ')}\n`;
            }
            
            // Add repeated words if any
            if (analytic.repetitions.repeatedWords && analytic.repetitions.repeatedWords.length > 0) {
              conversationContext += `- Repeated words: ${analytic.repetitions.repeatedWords.slice(0, 5).map((w: { word: string; count: number }) => `"${w.word}" (${w.count}×)`).join(', ')}\n`;
            }
          }
          conversationContext += `\n`;
        }

        // Add key facts
        if (facts && facts.length > 0) {
          conversationContext += `## KEY FACTS EXTRACTED FROM THE RECORDED CONVERSATION\n`;
          facts.forEach((factGroup: any) => {
            factGroup.facts.forEach((fact: string) => {
              conversationContext += `- ${fact}\n`;
            });
          });
          conversationContext += `\n`;
        }

        // Add full transcript with timestamps
        if (transcript && transcript.length > 0) {
          conversationContext += `## FULL RECORDED TRANSCRIPT\n`;
          transcript.forEach((turn: any) => {
            const timestamp =
              turn.timestamp != null ? `[${formatTimestamp(turn.timestamp)}] ` : "";
            conversationContext += `${timestamp}[${turn.speaker || "Speaker"}]: ${turn.text}\n`;
          });
        }

      } else {
        // === GENERAL MODE ===
        // Load last 10 conversations (existing behavior)
        const conversations = await ctx.runQuery(api.conversations.list, {});

        if (conversations.length > 0) {
          conversationContext = `\n\n## USER'S CONVERSATION HISTORY\nYou have access to ${conversations.length} conversation(s) from this user:\n\n`;

          for (const conv of conversations.slice(0, 10)) {
            const transcript = await ctx.runQuery(api.conversations.getTranscript, {
              conversationId: conv._id
            });

            const facts = await ctx.runQuery(api.conversations.getFacts, {
              conversationId: conv._id
            });

            conversationContext += `### Conversation ${conv._id} (${new Date(conv._creationTime).toLocaleDateString()})\n`;
            conversationContext += `Status: ${conv.status}\n`;
            if (conv.summary) conversationContext += `Summary: ${conv.summary}\n`;

            if (transcript.length > 0) {
              conversationContext += `Transcript:\n`;
              transcript.forEach((turn: any) => {
                conversationContext += `  - ${turn.speaker || 'Speaker'}: ${turn.text}\n`;
              });
            }

            if (facts.length > 0) {
              conversationContext += `Key Facts:\n`;
              facts.forEach((factGroup: any) => {
                factGroup.facts.forEach((fact: string) => {
                  conversationContext += `  - ${fact}\n`;
                });
              });
            }
            conversationContext += `\n`;
          }
        }
      }
    } catch (error) {
      console.error("Error fetching conversation context:", error);
    }
  }

  // Use different system prompts based on mode (either the user is chatting from one conversation on the analytics page, or the general chatbot)
  const systemPrompt = isConversationSpecific
    ? `You are an insightful Communication Analytics Assistant helping a user analyze their recorded conversation. Your role is to provide specific, actionable insights based on the transcript and analytics data.

## YOUR ROLE:
- Answer questions about the recorded conversation's transcript and analytics
- Provide specific insights referencing exact metrics (filler word counts, WPM, scores)
- Help users understand their communication patterns
- Suggest actionable improvements based on the analytics data
- Help users recall important points from the conversation
- Reference specific quotes from the transcript when relevant

## YOUR APPROACH:
- Be specific and reference exact numbers/quotes
- Be supportive but honest about areas for improvement
- Focus on actionable, practical advice
- Celebrate strengths while noting growth opportunities

${conversationContext}

When discussing analytics, always reference specific numbers and patterns from the data above. Be concise and actionable.`
    : `You are a warm, insightful Communication Coach and Reflection Expert for LinkMaxxing. Your role is to help users become more intentional, articulate communicators and build deeper relationships.

## YOUR PERSONALITY:
- Empathetic and supportive, like a trusted mentor
- Insightful but never judgmental
- Focus on growth, not criticism
- Celebrate progress and encourage self-awareness
- Use conversational, friendly language
- Ask thoughtful questions to deepen reflection

## YOUR EXPERTISE:
- Communication patterns and styles
- Relationship dynamics and connection-building
- Active listening and empathy development
- Conversation analysis and feedback
- Emotional intelligence and self-awareness
- Filler word reduction and articulation
- Building meaningful connections

## YOUR APPROACH:
1. Listen deeply to what users share
2. Analyze their conversations with care and nuance
3. Highlight patterns and insights they might have missed
4. Ask questions that promote self-reflection
5. Offer actionable, specific coaching tips
6. Remember that connection is the ultimate goal, not perfection

## WHEN ANALYZING CONVERSATIONS:
- Point out communication strengths first
- Identify patterns in speech, word choice, and engagement
- Note moments of genuine connection or missed opportunities
- Suggest specific improvements with examples
- Help users understand what they learned about themselves and others
- Recommend topics or approaches for future conversations

${conversationContext}

Remember: You're helping people "maxx out how they link" — deepening human connections through better communication. Be their supportive guide on this journey.`;

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages,
    async onFinish({ text }) {
      console.log("Chat response generated");
    },
  });

  // Respond with text stream (compatible with @ai-sdk/react v1.x)
  return result.toTextStreamResponse({
    headers: buildCorsHeaders(origin, "POST, OPTIONS"),
  });
});

const http = httpRouter();

http.route({
  path: "/api/chat",
  method: "POST",
  handler: chat,
});

http.route({
  path: "/api/chat",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    // Make sure the necessary headers are present
    // for this to be a valid pre-flight request
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      const origin = headers.get("Origin");
      if (origin && !getAllowedOrigin(origin)) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        headers: new Headers({
          ...buildCorsHeaders(origin, "POST"),
          "Access-Control-Max-Age": "86400",
        }),
      });
    } else {
      return new Response();
    }
  }),
});

http.route({
  path: "/api/auth/webhook",
  method: "POST",
  handler: httpAction(async (_, request) => {
    // Make sure the necessary headers are present
    // for this to be a valid pre-flight request
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      const origin = headers.get("Origin");
      if (origin && !getAllowedOrigin(origin)) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        headers: new Headers({
          ...buildCorsHeaders(origin, "POST"),
          "Access-Control-Max-Age": "86400",
        }),
      });
    } else {
      return new Response();
    }
  }),
});

http.route({
  path: "/payments/webhook",
  method: "POST",
  handler: paymentWebhook,
});

// Log that routes are configured
console.log("HTTP routes configured");

// Convex expects the router to be the default export of `convex/http.js`.
export default http;
