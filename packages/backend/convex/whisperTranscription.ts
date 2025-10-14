"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Transcribe audio using OpenAI Whisper for solo conversations
 * Returns a simple transcript without speaker diarization
 */
export const transcribeSoloAudio = action({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.object({
    text: v.string(),
  }),
  handler: async (ctx, args) => {
    console.log("Transcribing solo audio with Whisper...");

    // Get audio file from storage
    const audioBlob = await ctx.storage.get(args.storageId);
    if (!audioBlob) {
      throw new Error("Audio file not found");
    }

    // Convert blob to buffer for OpenAI
    const arrayBuffer = await audioBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Detect file type from blob or default to a common format
    // Whisper supports: m4a, mp3, mp4, mpeg, mpga, wav, webm
    const mimeType = audioBlob.type || "audio/mpeg";
    
    // Determine file extension from MIME type
    const extensionMap: Record<string, string> = {
      "audio/m4a": "m4a",
      "audio/x-m4a": "m4a",
      "audio/mp4": "m4a",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/wav": "wav",
      "audio/wave": "wav",
      "audio/webm": "webm",
      "audio/ogg": "ogg",
      "audio/aac": "aac",
    };
    
    const extension = extensionMap[mimeType] || "m4a";
    const filename = `recording.${extension}`;

    // Create a file object for OpenAI with correct MIME type
    const file = new File([buffer], filename, { type: mimeType });

    console.log(`Transcribing audio file: ${filename} (${mimeType})`);

    // Transcribe with OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      response_format: "text",
    });

    console.log("Whisper transcription complete");
    
    return {
      text: transcription as string,
    };
  },
});
