import { httpRouter } from "convex/server";
import { paymentWebhook } from "./subscriptions";
import { httpAction } from "./_generated/server";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { api } from "./_generated/api";

export const chat = httpAction(async (ctx, req) => {
  // Extract the `messages` from the body of the request
  const { messages } = await req.json();

  // Get user identity from auth
  const identity = await ctx.auth.getUserIdentity();

  let conversationContext = "";

  if (identity) {
    try {
      // Fetch user's conversations
      const conversations = await ctx.runQuery(api.conversations.list, {});

      if (conversations.length > 0) {
        conversationContext = `\n\n## USER'S CONVERSATION HISTORY\nYou have access to ${conversations.length} conversation(s) from this user:\n\n`;

        for (const conv of conversations.slice(0, 10)) { // Limit to most recent 10 conversations
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
    } catch (error) {
      console.error("Error fetching conversation context:", error);
    }
  }

  const systemPrompt = `You are a warm, insightful Communication Coach and Reflection Expert for Audora. Your role is to help users become more intentional, articulate communicators and build deeper relationships.

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

  // Respond with the stream
  return result.toDataStreamResponse({
    headers: {
      "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:5173",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
      Vary: "origin",
    },
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
      return new Response(null, {
        headers: new Headers({
          "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:5173",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
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
      return new Response(null, {
        headers: new Headers({
          "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:5173",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
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
