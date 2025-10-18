import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Migration: Add userId to conversationFacts and remove speaker field
 * This migrates old conversationFacts records to the new schema
 */
export const migrateConversationFacts = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all conversation facts
    const allFacts = await ctx.db.query("conversationFacts").collect();
    
    console.log(`Found ${allFacts.length} conversation facts to migrate`);
    
    let migrated = 0;
    let skipped = 0;
    
    for (const fact of allFacts) {
      const factAny = fact as any;
      
      // Check if already migrated (has userId and no speaker field at all)
      if (factAny.userId && !('speaker' in factAny)) {
        console.log(`Fact ${fact._id} already migrated, skipping`);
        skipped++;
        continue;
      }
      
      // Get the conversation to extract initiatorUserId
      const conversation = await ctx.db.get(fact.conversationId);
      
      if (!conversation) {
        console.error(`Conversation ${fact.conversationId} not found for fact ${fact._id}`);
        continue;
      }
      
      // Replace the document to remove speaker field
      await ctx.db.replace(fact._id, {
        conversationId: fact.conversationId,
        userId: factAny.userId || conversation.initiatorUserId,
        facts: fact.facts,
      });
      
      migrated++;
      
      console.log(`Migrated fact ${fact._id}: removed speaker, ensured userId ${factAny.userId || conversation.initiatorUserId}`);
    }
    
    console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped`);
    
    return {
      total: allFacts.length,
      migrated,
      skipped,
    };
  },
});

/**
 * Migration: Replace speaker field with userId in transcriptTurns
 * This migrates old transcriptTurns records to use userId instead of speaker name
 */
export const migrateTranscriptTurnsToUserId = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all transcript turns
    const allTurns = (await ctx.db.query("transcriptTurns").collect()) as any[];
    
    console.log(`Found ${allTurns.length} transcript turns to migrate`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const turn of allTurns) {
      // Check if already migrated (has userId and no speaker field)
      if (turn.userId && !('speaker' in turn)) {
        skipped++;
        continue;
      }
      
      // Get the conversation to determine the correct userId
      const conversation = await ctx.db.get(turn.conversationId);
      
      if (!conversation || conversation === null) {
        console.error(`Conversation ${turn.conversationId} not found for turn ${turn._id}`);
        errors++;
        continue;
      }
      
      // Type guard to ensure we have a conversations document
      if (!('initiatorUserId' in conversation)) {
        console.error(`Conversation ${turn.conversationId} is not a valid conversation`);
        errors++;
        continue;
      }
      
      let userId: Id<"users">;
      
      // If the speaker field looks like a userId (starts with right prefix), use it
      // Otherwise, try to match it to a user or default to initiator
      if (turn.speaker && typeof turn.speaker === 'string') {
        // Check if it's already a userId format
        if (turn.speaker.startsWith('j') || turn.speaker.startsWith('k')) {
          userId = turn.speaker as Id<"users">;
        } else {
          // Speaker is a name - try to match to initiator or scanner
          // Default to initiator for now
          userId = conversation.initiatorUserId;
          
          // If there's a scanner and this might be them, use scanner
          if (conversation.scannerUserId) {
            // Simple heuristic: if we have multiple speakers, alternate or use order
            const allTurnsInConvo = allTurns.filter(t => t.conversationId === turn.conversationId);
            const speakerNames = Array.from(new Set(allTurnsInConvo.map(t => t.speaker)));
            
            // If this is the second unique speaker, assume it's the scanner
            if (speakerNames.length > 1 && turn.speaker === speakerNames[1]) {
              userId = conversation.scannerUserId;
            }
          }
        }
      } else {
        // No speaker field, default to initiator
        userId = conversation.initiatorUserId;
      }
      
      // Replace the document with new schema
      await ctx.db.replace(turn._id, {
        conversationId: turn.conversationId,
        userId,
        text: turn.text,
        order: turn.order,
      });
      
      migrated++;
      
      if (migrated % 100 === 0) {
        console.log(`Migrated ${migrated} turns so far...`);
      }
    }
    
    console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
    
    return {
      total: allTurns.length,
      migrated,
      skipped,
      errors,
    };
  },
});

/**
 * Migration: Consolidate conversationFacts entries
 * Fixes the bug where each fact was saved in a separate row instead of all facts in one row per user
 */
export const consolidateConversationFacts = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all conversations
    const allConversations = await ctx.db.query("conversations").collect();
    
    console.log(`Found ${allConversations.length} conversations to process`);
    
    let consolidated = 0;
    let skipped = 0;
    
    for (const conversation of allConversations) {
      // Get all fact entries for this conversation
      const facts = await ctx.db
        .query("conversationFacts")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .collect();
      
      if (facts.length === 0) {
        continue;
      }
      
      // Group facts by userId
      const factsByUser = new Map<Id<"users">, string[]>();
      
      for (const fact of facts) {
        const existingFacts = factsByUser.get(fact.userId) || [];
        // Each fact row has an array of facts (usually just one due to the bug)
        factsByUser.set(fact.userId, [...existingFacts, ...fact.facts]);
      }
      
      // Check if consolidation is needed (more than one row per user)
      const needsConsolidation = factsByUser.size < facts.length;
      
      if (!needsConsolidation) {
        skipped++;
        continue;
      }
      
      console.log(`Consolidating facts for conversation ${conversation._id}: ${facts.length} rows -> ${factsByUser.size} rows`);
      
      // Delete all existing fact entries for this conversation
      for (const fact of facts) {
        await ctx.db.delete(fact._id);
      }
      
      // Insert consolidated entries (one per user with all their facts)
      for (const [userId, userFacts] of factsByUser.entries()) {
        if (userFacts.length > 0) {
          await ctx.db.insert("conversationFacts", {
            conversationId: conversation._id,
            userId,
            facts: userFacts,
          });
        }
      }
      
      consolidated++;
    }
    
    console.log(`Migration complete: ${consolidated} conversations consolidated, ${skipped} skipped`);
    
    return {
      total: allConversations.length,
      consolidated,
      skipped,
    };
  },
});

/**
 * Migration: Remove duplicate transcript turns
 * Fixes duplicate transcript entries caused by calling processRealtimeTranscript twice
 */
export const removeDuplicateTranscriptTurns = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all conversations
    const allConversations = await ctx.db.query("conversations").collect();
    
    console.log(`Found ${allConversations.length} conversations to check for duplicates`);
    
    let conversationsFixed = 0;
    let turnsDeleted = 0;
    
    for (const conversation of allConversations) {
      // Get all transcript turns for this conversation
      const turns = await ctx.db
        .query("transcriptTurns")
        .withIndex("by_conversation_and_order", (q) => q.eq("conversationId", conversation._id))
        .collect();
      
      if (turns.length === 0) {
        continue;
      }
      
      // Sort by order
      turns.sort((a, b) => a.order - b.order);
      
      // Track seen content to identify duplicates
      const seen = new Map<string, Id<"transcriptTurns">>();
      const duplicates: Id<"transcriptTurns">[] = [];
      
      for (const turn of turns) {
        // Create a unique key from order, userId, and text
        const key = `${turn.order}|${turn.userId}|${turn.text}`;
        
        if (seen.has(key)) {
          // This is a duplicate
          duplicates.push(turn._id);
        } else {
          seen.set(key, turn._id);
        }
      }
      
      // Delete duplicates
      if (duplicates.length > 0) {
        console.log(`Conversation ${conversation._id}: Deleting ${duplicates.length} duplicate turns out of ${turns.length} total`);
        
        for (const duplicateId of duplicates) {
          await ctx.db.delete(duplicateId);
          turnsDeleted++;
        }
        
        conversationsFixed++;
      }
    }
    
    console.log(`Migration complete: Fixed ${conversationsFixed} conversations, deleted ${turnsDeleted} duplicate turns`);
    
    return {
      total: allConversations.length,
      conversationsFixed,
      turnsDeleted,
    };
  },
});
