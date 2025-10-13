"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { createSpeechmaticsJWT } from "@speechmatics/auth";

/**
 * Generate a Speechmatics JWT for real-time transcription
 * This keeps the API key secure on the server side
 */
export const generateJWT = action({
  args: {},
  returns: v.string(),
  handler: async () => {
    const apiKey = process.env.SPEECHMATICS_API_KEY;

    if (!apiKey) {
      throw new Error("SPEECHMATICS_API_KEY not configured");
    }

    const jwt = await createSpeechmaticsJWT({
      type: "rt",
      apiKey,
      ttl: 24 * 60 * 60, // 1 day - adjust as needed
    });

    return jwt;
  },
});
