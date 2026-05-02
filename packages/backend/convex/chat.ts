import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

const GENERAL_THREAD_KEY = "general";

function isGeneralThreadKey(threadKey: string) {
  return threadKey === GENERAL_THREAD_KEY || threadKey.startsWith(`${GENERAL_THREAD_KEY}:`);
}

function buildThreadKey({
  conversationId,
  linkedConversationIds,
  threadKey,
}: {
  conversationId?: Id<"conversations">;
  linkedConversationIds?: Id<"conversations">[];
  threadKey?: string;
}) {
  if (threadKey) {
    return threadKey;
  }

  if (conversationId) {
    return `conversation:${conversationId}`;
  }

  if (!linkedConversationIds || linkedConversationIds.length === 0) {
    return GENERAL_THREAD_KEY;
  }

  const sortedIds = [...linkedConversationIds].map(String).sort();

  if (sortedIds.length === 1) {
    return `conversation:${sortedIds[0]}`;
  }

  return `multi:${sortedIds.join("|")}`;
}

function normalizeThreadKey(message: {
  threadKey?: string;
  conversationId?: Id<"conversations">;
}) {
  if (message.threadKey) {
    return message.threadKey;
  }

  if (message.conversationId) {
    return `conversation:${message.conversationId}`;
  }

  return GENERAL_THREAD_KEY;
}

function parseConversationIdsFromThreadKey(threadKey: string) {
  if (isGeneralThreadKey(threadKey)) {
    return [];
  }

  if (threadKey.startsWith("conversation:")) {
    return [threadKey.slice("conversation:".length)];
  }

  if (threadKey.startsWith("multi:")) {
    return threadKey
      .slice("multi:".length)
      .split("|")
      .filter(Boolean);
  }

  return [];
}

function getSingleConversationId(threadKey: string) {
  const ids = parseConversationIdsFromThreadKey(threadKey);
  return ids.length === 1 ? (ids[0] as Id<"conversations">) : undefined;
}

function getThreadTitle(
  threadKey: string,
  conversationsById: Map<string, { location?: string; _creationTime: number }>
) {
  if (isGeneralThreadKey(threadKey)) {
    return "General chat";
  }

  const conversationIds = parseConversationIdsFromThreadKey(threadKey);

  if (conversationIds.length === 1) {
    const conversation = conversationsById.get(conversationIds[0]);
    if (!conversation) {
      return "Conversation chat";
    }

    if (conversation.location?.trim()) {
      return conversation.location;
    }

    return new Date(conversation._creationTime).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return `${conversationIds.length} linked conversations`;
}

// Get all chat messages for a conversation (for a specific user)
export const getMessages = query({
  args: {
    conversationId: v.optional(v.id("conversations")),
    linkedConversationIds: v.optional(v.array(v.id("conversations"))),
    threadKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    if (!user) {
      return [];
    }

    const threadKey = buildThreadKey({
      conversationId: args.conversationId,
      linkedConversationIds: args.linkedConversationIds,
      threadKey: args.threadKey,
    });

    let messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_user_and_thread", (q) => q.eq("userId", user._id).eq("threadKey", threadKey))
      .collect();

    const fallbackConversationId = args.conversationId ?? getSingleConversationId(threadKey);

    if (messages.length === 0 && fallbackConversationId) {
      messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_conversation_and_user", (q) =>
          q.eq("conversationId", fallbackConversationId).eq("userId", user._id)
        )
        .collect();
    }

    // Sort by creation time
    return messages.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const listThreads = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    if (!user) {
      return [];
    }

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const latestByThread = new Map<string, (typeof messages)[number]>();

    for (const message of messages) {
      const threadKey = normalizeThreadKey(message);
      const existing = latestByThread.get(threadKey);

      if (!existing || message.createdAt > existing.createdAt) {
        latestByThread.set(threadKey, message);
      }
    }

    const conversationIds = Array.from(
      new Set(
        Array.from(latestByThread.keys()).flatMap((threadKey) => parseConversationIdsFromThreadKey(threadKey))
      )
    ) as Id<"conversations">[];

    const conversations = await Promise.all(conversationIds.map((conversationId) => ctx.db.get(conversationId)));
    const conversationsById = new Map(
      conversations
        .filter((conversation): conversation is NonNullable<typeof conversation> => Boolean(conversation))
        .map((conversation) => [String(conversation._id), conversation])
    );

    return Array.from(latestByThread.entries())
      .map(([threadKey, message]) => {
        const linkedConversationIds = parseConversationIdsFromThreadKey(threadKey) as Id<"conversations">[];

        return {
          threadKey,
          linkedConversationIds,
          title: getThreadTitle(threadKey, conversationsById),
          preview: message.content,
          updatedAt: message.createdAt,
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// Save a chat message
export const saveMessage = mutation({
  args: {
    conversationId: v.optional(v.id("conversations")),
    linkedConversationIds: v.optional(v.array(v.id("conversations"))),
    threadKey: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const singleConversationId =
      args.conversationId ??
      (args.linkedConversationIds?.length === 1 ? args.linkedConversationIds[0] : undefined);

    if (singleConversationId) {
      const conversation = await ctx.db.get(singleConversationId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
    }

    if (args.linkedConversationIds && args.linkedConversationIds.length > 1) {
      const linkedConversations = await Promise.all(
        args.linkedConversationIds.map((conversationId) => ctx.db.get(conversationId))
      );

      if (linkedConversations.some((conversation) => !conversation)) {
        throw new Error("One or more linked conversations were not found");
      }
    }

    const threadKey = buildThreadKey({
      conversationId: singleConversationId,
      linkedConversationIds: args.linkedConversationIds,
      threadKey: args.threadKey,
    });

    // Save the message
    const messageId = await ctx.db.insert("chatMessages", {
      conversationId: singleConversationId,
      userId: user._id,
      threadKey,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
    });

    return messageId;
  },
});
