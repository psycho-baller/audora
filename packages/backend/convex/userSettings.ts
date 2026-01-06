import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getSettings = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    if (!user) {
      return null;
    }

    const settings = await ctx.db
      .query("user_settings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!settings) {
      return {
        userId: user._id,
        realtimeFillerWords: false,
        realtimeVocabulary: false,
        dashboardFillerWords: false,
        dashboardVocabulary: false,
      };
    }

    return settings;
  },
});

export const updateSettings = mutation({
  args: {
    realtimeFillerWords: v.optional(v.boolean()),
    realtimeVocabulary: v.optional(v.boolean()),
    dashboardFillerWords: v.optional(v.boolean()),
    dashboardVocabulary: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const existing = await ctx.db
      .query("user_settings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const updates: Partial<{
      realtimeFillerWords: boolean;
      realtimeVocabulary: boolean;
      dashboardFillerWords: boolean;
      dashboardVocabulary: boolean;
    }> = {};
    if (args.realtimeFillerWords !== undefined) updates.realtimeFillerWords = args.realtimeFillerWords;
    if (args.realtimeVocabulary !== undefined) updates.realtimeVocabulary = args.realtimeVocabulary;
    if (args.dashboardFillerWords !== undefined) updates.dashboardFillerWords = args.dashboardFillerWords;
    if (args.dashboardVocabulary !== undefined) updates.dashboardVocabulary = args.dashboardVocabulary;

    if (existing) {
      await ctx.db.patch(existing._id, updates);
      return { ...existing, ...updates };
    } else {
      const newSettings = {
        userId: user._id,
        realtimeFillerWords: args.realtimeFillerWords ?? false,
        realtimeVocabulary: args.realtimeVocabulary ?? false,
        dashboardFillerWords: args.dashboardFillerWords ?? false,
        dashboardVocabulary: args.dashboardVocabulary ?? false,
      };
      const id = await ctx.db.insert("user_settings", newSettings);
      return { _id: id, ...newSettings };
    }
  },
});
