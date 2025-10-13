"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { BatchClient } from "@speechmatics/batch-client";
import { openai as openaiProvider } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { ZepClient } from "@getzep/zep-cloud";

const zepClient = new ZepClient({
  apiKey: process.env.ZEP_API_KEY || "",
});

const GRAPH_ID = process.env.ZEP_GRAPH_ID || "mru-2025";

/**
 * Transcribe audio file using Speechmatics Batch API (chunk only - no DB save)
 * Use this for processing individual chunks
 */
export const transcribeChunkOnly = action({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.object({
    transcript: v.array(v.object({ speaker: v.string(), text: v.string() })),
    S1_facts: v.array(v.string()),
    S2_facts: v.array(v.string()),
    summary: v.string(),
  }),
  handler: async (ctx, args) => {
    console.log("Starting batch transcription for chunk (no DB save)");

    // Get audio file from storage
    const audioBlob = await ctx.storage.get(args.storageId);
    if (!audioBlob) {
      throw new Error("Audio file not found in storage");
    }

    // Convert blob to buffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`Audio file size: ${buffer.length} bytes`);

    // Determine file extension
    const mimeType = audioBlob.type || "audio/webm";
    let extension = "webm";
    if (mimeType.includes("mp4")) extension = "mp4";
    else if (mimeType.includes("mpeg") || mimeType.includes("mp3")) extension = "mp3";
    else if (mimeType.includes("ogg")) extension = "ogg";
    else if (mimeType.includes("wav")) extension = "wav";
    else if (mimeType.includes("flac")) extension = "flac";
    else if (mimeType.includes("m4a")) extension = "m4a";

    // Create File object for Speechmatics
    const file = new File([buffer], `recording.${extension}`, { type: mimeType });

    // Initialize Speechmatics batch client
    const client = new BatchClient({
      apiKey: process.env.SPEECHMATICS_API_KEY!,
      appId: "convex-batch-transcription",
    });

    // Transcribe with Speechmatics
    let transcriptTurns: Array<{
      speaker: string;
      text: string;
      startTime: number;
      endTime: number;
    }>;

    try {
      const response = await client.transcribe(
        file,
        {
          transcription_config: {
            language: "en",
            operating_point: "enhanced",
            diarization: "speaker",
            speaker_diarization_config: {},
          },
        },
        "json-v2"
      );

      transcriptTurns = processTranscriptResponse(response);
    } catch (error: any) {
      console.error("Speechmatics error:", error);
      throw new Error(`Speechmatics transcription failed: ${error.message}`);
    }

    // Simple transcript format for chunks
    const transcript = transcriptTurns.map(turn => ({
      speaker: turn.speaker,
      text: turn.text,
    }));

    // Format for AI analysis
    const formattedTranscript = transcriptTurns
      .map(turn => `${turn.speaker}: ${turn.text}`)
      .join("\n");

    // AI analysis for facts & summary
    const { object: aiAnalysis } = await generateObject({
      model: openaiProvider("gpt-4o"),
      schema: z.object({
        S1_facts: z.array(z.string()).default([]),
        S2_facts: z.array(z.string()).default([]),
        summary: z.string().default(""),
      }),
      prompt: `Extract key facts from this conversation transcript:\n\n${formattedTranscript}`,
    });

    return {
      transcript,
      S1_facts: aiAnalysis.S1_facts,
      S2_facts: aiAnalysis.S2_facts,
      summary: aiAnalysis.summary,
    };
  },
});

/**
 * Transcribe audio file using Speechmatics Batch API
 * This provides more accurate transcription than real-time, processed after recording ends
 */
export const batchTranscribe = action({
  args: {
    storageId: v.id("_storage"),
    conversationId: v.id("conversations"),
    initiatorName: v.optional(v.string()),
    scannerName: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    userName: v.optional(v.string()),
  },
  returns: v.object({
    transcript: v.array(v.object({ speaker: v.string(), text: v.string() })),
    S1_facts: v.array(v.string()),
    S2_facts: v.array(v.string()),
    summary: v.string(),
  }),
  handler: async (ctx, args) => {
    console.log("Starting batch transcription for conversation:", args.conversationId);

    // Step 1: Get audio file from storage
    const audioBlob = await ctx.storage.get(args.storageId);
    if (!audioBlob) {
      throw new Error("Audio file not found in storage");
    }

    // Convert blob to buffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`Audio file size: ${buffer.length} bytes`);
    console.log(`Audio MIME type: ${audioBlob.type}`);

    // Determine file extension based on MIME type
    const mimeType = audioBlob.type || "audio/webm";
    let extension = "webm";
    if (mimeType.includes("mp4")) extension = "mp4";
    else if (mimeType.includes("mpeg") || mimeType.includes("mp3")) extension = "mp3";
    else if (mimeType.includes("ogg")) extension = "ogg";
    else if (mimeType.includes("wav")) extension = "wav";
    else if (mimeType.includes("flac")) extension = "flac";
    else if (mimeType.includes("m4a")) extension = "m4a";

    console.log(`Using file extension: ${extension}`);

    // Create File object for Speechmatics
    const file = new File([buffer], `recording.${extension}`, { type: mimeType });

    // Initialize Speechmatics batch client
    const client = new BatchClient({
      apiKey: process.env.SPEECHMATICS_API_KEY!,
      appId: "convex-batch-transcription",
    });

    console.log("Sending file to Speechmatics batch API...");

    // Step 2: Transcribe with Speechmatics
    let transcriptTurns: Array<{
      speaker: string;
      text: string;
      startTime: number;
      endTime: number;
    }>;

    try {
      const response = await client.transcribe(
        file,
        {
          transcription_config: {
            language: "en",
            operating_point: "enhanced",
            diarization: "speaker",
            speaker_diarization_config: {},
          },
        },
        "json-v2"
      );

      console.log("Batch transcription complete!");
      transcriptTurns = processTranscriptResponse(response);
    } catch (error: any) {
      console.error("Speechmatics error:", error);
      console.error("Error details:", error.message);
      if (error.response) {
        console.error("Error response:", JSON.stringify(error.response));
      }
      throw new Error(`Speechmatics transcription failed: ${error.message}`);
    }

    console.log(`Received ${transcriptTurns.length} conversation turns from Speechmatics`);

    // Step 3: Get conversation to access user IDs
    const conversation = await ctx.runQuery(api.conversations.get, {
      id: args.conversationId,
    });
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Step 4: Map S1 to initiator userId, S2 to scanner userId
    const speakerToUserIdMap: Record<string, Id<"users">> = {
      S1: conversation.initiatorUserId as Id<"users">,
      S2: (conversation.scannerUserId || conversation.initiatorUserId) as Id<"users">,
    };

    // Map for display names (for AI processing)
    const speakerMap: Record<string, string> = {
      S1: args.initiatorName || "S1",
      S2: args.scannerName || "S2",
    };

    console.log("Speaker mapping:", speakerMap);
    console.log("Speaker to userId mapping:", speakerToUserIdMap);

    // Step 5: Convert transcript turns with userIds for storage
    const transcriptWithUserIds = transcriptTurns.map(turn => ({
      speaker: turn.speaker,
      userId: (speakerToUserIdMap[turn.speaker] || conversation.initiatorUserId) as Id<"users">,
      text: turn.text,
    }));

    // Convert transcript turns with actual names for AI analysis
    const transcript = transcriptTurns.map(turn => ({
      speaker: speakerMap[turn.speaker] || turn.speaker,
      text: turn.text,
    }));

    // Step 6: Format transcript for AI analysis with actual names
    const formattedTranscript = transcriptTurns
      .map(turn => {
        const speakerName = speakerMap[turn.speaker] || turn.speaker;
        return `${speakerName}: ${turn.text}`;
      })
      .join("\n");

    console.log("Formatted transcript with names for AI processing");

    // Step 7: Use AI for facts extraction and summary generation
    const { object: aiAnalysis } = await generateObject({
      model: openaiProvider("gpt-4o"),
      schema: z.object({
        S1_facts: z.array(z.string()).describe(`Facts extracted for ${speakerMap["S1"]}`).default([]),
        S2_facts: z.array(z.string()).describe(`Facts extracted for ${speakerMap["S2"]}`).default([]),
        summary: z.string().describe("Brief summary of the conversation").default(""),
      }),
      prompt: `You are an AI assistant that analyzes conversation transcripts to extract key facts and generate summaries.

SPEAKERS:
- ${speakerMap["S1"]}: The person who initiated the conversation
- ${speakerMap["S2"]}: The person who joined the conversation

REQUIREMENTS:
- Extract only explicit, concrete facts directly stated by each person
- Do not include questions, opinions, or interpretations in facts
- Facts should be organized by speaker name
- Use the actual speaker names provided above as keys in the facts object
- Generate a concise summary of key points and outcomes

TRANSCRIPT:
${formattedTranscript}

Provide:
1. facts: Key facts extracted for each speaker separately (use actual names as keys: "${args.initiatorName || "Speaker 1"}" and "${args.scannerName || "Speaker 2"}")
2. summary: Concise summary of key points and outcomes`,
    });

    console.log("AI analysis complete:", aiAnalysis);

    // Step 8: Process with Zep if available
    if (transcript && aiAnalysis.S1_facts && aiAnalysis.S2_facts) {
      try {
        await processWithZep(
          { transcript, facts: aiAnalysis.S1_facts, summary: aiAnalysis.summary },
          args.conversationId,
          args.userEmail,
          args.userName
        );
      } catch (error) {
        console.error("Zep processing error:", error);
        // Continue without Zep
      }
    }

    // Step 9: Save to Convex database
    await ctx.runMutation(api.conversations.saveTranscriptData, {
      conversationId: args.conversationId,
      transcript: transcriptWithUserIds,
      S1_facts: aiAnalysis.S1_facts,
      S2_facts: aiAnalysis.S2_facts,
      initiatorName: args.initiatorName,
      scannerName: args.scannerName,
      summary: aiAnalysis.summary,
    });

    return {
      transcript: transcript,
      S1_facts: aiAnalysis.S1_facts,
      S2_facts: aiAnalysis.S2_facts,
      summary: aiAnalysis.summary,
    };
  },
});

// Helper function to process Speechmatics transcript response
function processTranscriptResponse(response: any): Array<{
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}> {
  // Process results into structured format
  const transcript: Array<{
    speaker: string;
    text: string;
    startTime: number;
    endTime: number;
  }> = [];

  if (typeof response !== "string" && response.results) {
    let currentTurn: {
      speaker: string;
      text: string;
      startTime: number;
      endTime: number;
    } | null = null;

    for (const result of response.results) {
      if (result.type === "word") {
        const speaker = result.alternatives?.[0]?.speaker || "Unknown";
        const content = result.alternatives?.[0]?.content || "";
        const startTime = result.start_time || 0;
        const endTime = result.end_time || 0;

        // If new speaker or first word, create new turn
        if (!currentTurn || currentTurn.speaker !== speaker) {
          if (currentTurn) {
            transcript.push(currentTurn);
          }
          currentTurn = {
            speaker,
            text: content,
            startTime,
            endTime,
          };
        } else {
          // Same speaker, append to current turn
          currentTurn.text += ` ${content}`;
          currentTurn.endTime = endTime;
        }
      }
    }

    // Push final turn
    if (currentTurn) {
      transcript.push(currentTurn);
    }
  }

  console.log(`Processed ${transcript.length} conversation turns from batch transcription`);

  return transcript;
}

// Helper function to process with Zep (knowledge graph)
async function processWithZep(
  parsedResult: any,
  conversationId: Id<"conversations">,
  userEmail?: string,
  userName?: string
) {
  // Ensure graph exists
  try {
    await zepClient.graph.get(GRAPH_ID);
  } catch {
    await zepClient.graph.create({
      graphId: GRAPH_ID,
    });
  }

  // Get unique speakers
  const speakers = new Set<string>();
  for (const turn of parsedResult.transcript) {
    if (turn.speaker) {
      speakers.add(turn.speaker);
    }
  }

  console.log("Identified speakers:", Array.from(speakers));

  // Create user entities
  for (const speaker of speakers) {
    await createUserEntity(speaker, userEmail, userName);
  }

  // Extract and store entities from facts
  await extractAndStoreEntities(parsedResult.facts, speakers);

  // Create friendship relationships
  await createFriendshipRelationships(speakers);

  // Store conversation summary
  await storeConversationSummary(parsedResult.summary, conversationId, speakers);
}

async function createUserEntity(speaker: string, userEmail?: string, userName?: string) {
  try {
    const searchResults = await zepClient.graph.search({
      graphId: GRAPH_ID,
      query: speaker,
      scope: "nodes",
      searchFilters: { nodeLabels: ["User"] },
      limit: 1,
    });

    if (searchResults.nodes && searchResults.nodes.length > 0) {
      console.log(`User ${speaker} already exists`);
      return;
    }

    const userData = {
      action: "Create_entity",
      entity_type: "User",
      name: speaker,
      description: `User identified from conversation: ${speaker}`,
    };

    await zepClient.graph.add({
      data: JSON.stringify(userData),
      type: "json",
      graphId: GRAPH_ID,
    });

    console.log(`Created user entity: ${speaker}`);
  } catch (error) {
    console.error(`Failed to create user entity ${speaker}:`, error);
  }
}

async function extractAndStoreEntities(facts: Record<string, string[]>, speakers: Set<string>) {
  const entityPatterns: Record<string, RegExp[]> = {
    Goal: [
      /(?:wants to|plans to|hopes to|aims to|goal is to|trying to)\s+(.+)/i,
      /(?:my goal is|i want to|i plan to|i hope to|i aim to)\s+(.+)/i,
    ],
    Language: [
      /(?:speaks|knows|fluent in|can speak)\s+([\w\s]+?)(?:\s+(?:language|fluently))?/i,
      /(?:native|bilingual|multilingual)\s+(?:in\s+)?([\w\s]+)/i,
    ],
    Organization: [
      /(?:works at|employed by|job at|working at)\s+(.+)/i,
      /(?:my job is at|i work at|employed at)\s+(.+)/i,
    ],
    Topic: [
      /(?:interested in|likes|enjoys|passionate about|loves|into)\s+(.+)/i,
      /(?:my interest is|i like|i enjoy|i love)\s+(.+)/i,
    ],
    Trait: [
      /(?:is|personality|character).*?(outgoing|introverted|friendly|shy|confident|creative|analytical|organized|spontaneous|patient|ambitious|calm|energetic)/i,
      /(?:i am|i'm)\s+(outgoing|introverted|friendly|shy|confident|creative|analytical|organized|spontaneous|patient|ambitious|calm|energetic)/i,
    ],
  };

  const relationshipTypes: Record<string, string> = {
    Goal: "HAS_GOAL",
    Language: "SPEAKS",
    Organization: "WORKS_AT",
    Topic: "INTERESTED_IN",
    Trait: "HAS_TRAIT",
  };

  for (const [speaker, speakerFacts] of Object.entries(facts)) {
    for (const fact of speakerFacts) {
      for (const [entityType, patterns] of Object.entries(entityPatterns)) {
        for (const pattern of patterns) {
          const match = pattern.exec(fact);
          if (match) {
            const entityName = match[1].trim();

            if (entityName.length < 2 || ["it", "that", "this", "them"].includes(entityName.toLowerCase())) {
              continue;
            }

            try {
              // Create entity
              const entityData = {
                action: "Create_entity",
                entity_type: entityType,
                name: entityName,
                description: fact,
              };

              await zepClient.graph.add({
                data: JSON.stringify(entityData),
                type: "json",
                graphId: GRAPH_ID,
              });

              // Create relationship
              const relationshipData = {
                action: "Create_relationship",
                source_entity_type: "User",
                source_entity_name: speaker,
                target_entity_type: entityType,
                target_entity_name: entityName,
                relationship_type: relationshipTypes[entityType],
                description: fact,
              };

              await zepClient.graph.add({
                data: JSON.stringify(relationshipData),
                type: "json",
                graphId: GRAPH_ID,
              });

              console.log(`Created relationship: ${speaker} -> ${relationshipTypes[entityType]} -> ${entityName}`);
            } catch (error) {
              console.error(`Failed to create entity/relationship for ${entityName}:`, error);
            }

            break;
          }
        }
      }
    }
  }
}

async function createFriendshipRelationships(speakers: Set<string>) {
  if (speakers.size < 2) return;

  const speakerList = Array.from(speakers);
  for (let i = 0; i < speakerList.length; i++) {
    for (let j = i + 1; j < speakerList.length; j++) {
      const speaker1 = speakerList[i];
      const speaker2 = speakerList[j];

      for (const [source, target] of [[speaker1, speaker2], [speaker2, speaker1]]) {
        try {
          const friendshipData = {
            action: "Create_relationship",
            source_entity_type: "User",
            source_entity_name: source,
            target_entity_type: "User",
            target_entity_name: target,
            relationship_type: "FRIENDS_WITH",
            description: "Friends based on conversation",
          };

          await zepClient.graph.add({
            data: JSON.stringify(friendshipData),
            type: "json",
            graphId: GRAPH_ID,
          });
        } catch (error) {
          console.error(`Failed to create friendship ${source} -> ${target}:`, error);
        }
      }

      console.log(`Created friendship: ${speaker1} <-> ${speaker2}`);
    }
  }
}

async function storeConversationSummary(
  summary: string,
  conversationId: Id<"conversations">,
  speakers: Set<string>
) {
  try {
    const conversationName = `Conversation_${conversationId}_${Date.now()}`;

    const summaryData = {
      action: "Create_entity",
      entity_type: "Conversation",
      name: conversationName,
      description: `Summary: ${summary} | Participants: ${Array.from(speakers).join(", ")} | ConversationID: ${conversationId}`,
    };

    await zepClient.graph.add({
      data: JSON.stringify(summaryData),
      type: "json",
      graphId: GRAPH_ID,
    });

    // Create participation relationships
    for (const speaker of speakers) {
      try {
        const participationData = {
          action: "Create_relationship",
          source_entity_type: "User",
          source_entity_name: speaker,
          target_entity_type: "Conversation",
          target_entity_name: conversationName,
          relationship_type: "PARTICIPATED_IN",
          description: `Participated in conversation on ${new Date().toISOString()}`,
        };

        await zepClient.graph.add({
          data: JSON.stringify(participationData),
          type: "json",
          graphId: GRAPH_ID,
        });
      } catch (error) {
        console.error(`Failed to create participation for ${speaker}:`, error);
      }
    }

    console.log(`Added conversation summary to graph: ${conversationName}`);
  } catch (error) {
    console.error("Failed to add conversation summary:", error);
  }
}
