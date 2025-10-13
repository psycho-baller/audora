import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const possibleIdentifiers: string[] = [];
  if (identity.tokenIdentifier) {
    const parts = identity.tokenIdentifier.split("|");
    if (parts.length > 1) {
      possibleIdentifiers.push(parts[1]);
    }
  }
  if (identity.subject) {
    possibleIdentifiers.push(identity.subject);
  }

  for (const token of possibleIdentifiers) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", token))
      .unique();
    if (user) {
      return user;
    }
  }

  return null;
}

const networkEntry = v.object({
  contactId: v.id("users"),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  image: v.optional(v.string()),
  conversationCount: v.number(),
  totalTurns: v.number(),
  lastInteractionAt: v.number(),
  lastConversationId: v.id("conversations"),
});

type NetworkEntry = {
  conversationCount: number;
  totalTurns: number;
  lastInteractionAt: number;
  lastConversationId: Id<"conversations">;
};

export const list = query({
  args: {},
  returns: v.array(networkEntry),
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return [];
    }

    const [asInitiator, asScanner] = await Promise.all([
      ctx.db
        .query("conversations")
        .withIndex("by_initiator", (q) => q.eq("initiatorUserId", currentUser._id))
        .collect(),
      ctx.db
        .query("conversations")
        .withIndex("by_scanner", (q) => q.eq("scannerUserId", currentUser._id))
        .collect(),
    ]);

    const conversationMap = new Map<Id<"conversations">, Doc<"conversations">>();
    for (const conversation of [...asInitiator, ...asScanner]) {
      conversationMap.set(conversation._id, conversation);
    }

    const contacts = new Map<Id<"users">, NetworkEntry>();

    for (const conversation of conversationMap.values()) {
      const interactionTimestamp = conversation.endedAt ?? conversation.startedAt ?? conversation._creationTime;

      const participantIds = new Set<Id<"users">>();
      participantIds.add(conversation.initiatorUserId);
      if (conversation.scannerUserId) {
        participantIds.add(conversation.scannerUserId);
      }

      const turns = await ctx.db
        .query("transcriptTurns")
        .withIndex("by_conversation_and_user", (q) => q.eq("conversationId", conversation._id))
        .collect();

      const turnsByUser = new Map<Id<"users">, number>();
      for (const turn of turns) {
        if (!turn.userId) {
          continue;
        }
        participantIds.add(turn.userId);
        const count = turnsByUser.get(turn.userId) ?? 0;
        turnsByUser.set(turn.userId, count + 1);
      }

      participantIds.delete(currentUser._id);

      for (const participantId of participantIds) {
        const turnsCount = turnsByUser.get(participantId) ?? 0;
        const existing = contacts.get(participantId);

        if (!existing) {
          contacts.set(participantId, {
            conversationCount: 1,
            totalTurns: turnsCount,
            lastInteractionAt: interactionTimestamp,
            lastConversationId: conversation._id,
          });
        } else {
          const lastInteractionAt = Math.max(existing.lastInteractionAt, interactionTimestamp);
          contacts.set(participantId, {
            conversationCount: existing.conversationCount + 1,
            totalTurns: existing.totalTurns + turnsCount,
            lastInteractionAt,
            lastConversationId:
              lastInteractionAt >= existing.lastInteractionAt
                ? conversation._id
                : existing.lastConversationId,
          });
        }
      }
    }

    const results = [];
    for (const [contactId, info] of contacts.entries()) {
      const contact = await ctx.db.get(contactId);
      if (!contact) {
        continue;
      }

      results.push({
        contactId,
        name: contact.name ?? undefined,
        email: contact.email ?? undefined,
        image: contact.image ?? undefined,
        conversationCount: info.conversationCount,
        totalTurns: info.totalTurns,
        lastInteractionAt: info.lastInteractionAt,
        lastConversationId: info.lastConversationId,
      });
    }

    results.sort((a, b) => b.lastInteractionAt - a.lastInteractionAt);
    return results;
  },
});

// Get detailed information about a specific contact
export const getContactDetails = query({
  args: { contactId: v.id("users") },
  returns: v.union(
    v.object({
      contact: v.object({
        _id: v.id("users"),
        name: v.optional(v.string()),
        email: v.optional(v.string()),
        image: v.optional(v.string()),
      }),
      conversations: v.array(
        v.object({
          _id: v.id("conversations"),
          _creationTime: v.number(),
          status: v.union(v.literal("pending"), v.literal("active"), v.literal("ended")),
          startedAt: v.optional(v.number()),
          endedAt: v.optional(v.number()),
          summary: v.optional(v.string()),
          location: v.optional(v.string()),
        })
      ),
      sharedFacts: v.object({
        currentUserFacts: v.array(v.string()),
        contactFacts: v.array(v.string()),
      }),
      stats: v.object({
        totalConversations: v.number(),
        totalDuration: v.number(), // in milliseconds
        currentUserTurns: v.number(),
        contactTurns: v.number(),
      }),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return null;
    }

    // Get contact user info
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      return null;
    }

    // Get all conversations between current user and contact
    const [asInitiator, asScanner] = await Promise.all([
      ctx.db
        .query("conversations")
        .withIndex("by_initiator", (q) => q.eq("initiatorUserId", currentUser._id))
        .collect(),
      ctx.db
        .query("conversations")
        .withIndex("by_scanner", (q) => q.eq("scannerUserId", currentUser._id))
        .collect(),
    ]);

    // Filter to only conversations with the specific contact
    const allConversations = [...asInitiator, ...asScanner];
    const conversationsWithContact = allConversations.filter(
      (conv) =>
        conv.initiatorUserId === args.contactId ||
        conv.scannerUserId === args.contactId
    );

    // Sort by most recent first
    conversationsWithContact.sort((a, b) => {
      const aTime = a.endedAt ?? a.startedAt ?? a._creationTime;
      const bTime = b.endedAt ?? b.startedAt ?? b._creationTime;
      return bTime - aTime;
    });

    // Get shared facts from all conversations
    const currentUserFactsSet = new Set<string>();
    const contactFactsSet = new Set<string>();
    let totalDuration = 0;
    let currentUserTurns = 0;
    let contactTurns = 0;

    for (const conversation of conversationsWithContact) {
      // Calculate duration
      if (conversation.startedAt && conversation.endedAt) {
        totalDuration += conversation.endedAt - conversation.startedAt;
      }

      // Get facts
      const facts = await ctx.db
        .query("conversationFacts")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .collect();

      for (const fact of facts) {
        if (fact.userId === currentUser._id) {
          fact.facts.forEach((f) => currentUserFactsSet.add(f));
        } else if (fact.userId === args.contactId) {
          fact.facts.forEach((f) => contactFactsSet.add(f));
        }
      }

      // Get turn counts
      const turns = await ctx.db
        .query("transcriptTurns")
        .withIndex("by_conversation_and_order", (q) => q.eq("conversationId", conversation._id))
        .collect();

      for (const turn of turns) {
        if (turn.userId === currentUser._id) {
          currentUserTurns++;
        } else if (turn.userId === args.contactId) {
          contactTurns++;
        }
      }
    }

    return {
      contact: {
        _id: contact._id,
        name: contact.name ?? undefined,
        email: contact.email ?? undefined,
        image: contact.image ?? undefined,
      },
      conversations: conversationsWithContact.map((conv) => ({
        _id: conv._id,
        _creationTime: conv._creationTime,
        status: conv.status,
        startedAt: conv.startedAt ?? undefined,
        endedAt: conv.endedAt ?? undefined,
        summary: conv.summary ?? undefined,
        location: conv.location ?? undefined,
      })),
      sharedFacts: {
        currentUserFacts: Array.from(currentUserFactsSet),
        contactFacts: Array.from(contactFactsSet),
      },
      stats: {
        totalConversations: conversationsWithContact.length,
        totalDuration,
        currentUserTurns,
        contactTurns,
      },
    };
  },
});
