"use node";

import { action } from "./_generated/server";

export const generateSession = action({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured on the backend.");
    }

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        modalities: ["audio", "text"],
        instructions: `You are an AI communication coach monitoring a user's speech in real-time.
        Your goal is to help them speak more clearly and confidently.

        1. LISTEN passively to the user's audio.
        2. DETECT "filler words" (um, uh, like, you know) or long pauses.
        3. IF you detect significant filler words (more than 2 in a sentence) or a pattern of disfluency:
           - DO NOT SPEAK to the user.
           - CALL the 'notify_user' tool with a helpful, short message (e.g., "Try pausing instead of 'um'").

        4. IF you detect excellent clarity or a strong point:
           - You may optionally call 'notify_user' with positive reinforcement (e.g., "Great point!").

        5. DO NOT interrupt the user with voice unless explicitly asked. Your primary feedback mechanism is the 'notify_user' tool.
        `,
        tools: [
          {
            type: "function",
            name: "notify_user",
            description: "Send a visual notification to the user with feedback about their speech.",
            parameters: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "The short feedback message to display to the user.",
                },
                type: {
                  type: "string",
                  enum: ["alert", "success"],
                  description: "The type of notification: 'alert' for constructive feedback, 'success' for praise.",
                },
              },
              required: ["message", "type"],
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to generate OpenAI session: ${error}`);
    }

    const data = await response.json();
    return data;
  },
});
