import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all chat messages for a conversation (for a specific user)
export const getMessages = query({
  args: {
    conversationId: v.id("conversations"),
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

    // Get all messages for this conversation and user
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_conversation_and_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user._id)
      )
      .collect();

    // Sort by creation time
    return messages.sort((a, b) => a.createdAt - b.createdAt);
  },
});

// Save a chat message
export const saveMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
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

    // Verify conversation exists
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Save the message
    const messageId = await ctx.db.insert("chatMessages", {
      conversationId: args.conversationId,
      userId: user._id,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
    });

    return messageId;
  },
});
