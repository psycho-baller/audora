import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getCurrentUser = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    return user;
  },
});

export const findUserByToken = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    // Get the user's identity from the auth context
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    // Check if we've already stored this identity before
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    if (user !== null) {
      return user;
    }

    return null;
  },
});

async function generateUniqueInviteCode(ctx: any): Promise<string> {
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    const code = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    const existing = await ctx.db
      .query("users")
      .withIndex("by_invite_code", (q: any) => q.eq("inviteCode", code))
      .unique();
    if (!existing) {
      return code;
    }
  }
  throw new Error("Failed to generate unique invite code after 20 attempts");
}

export const upsertUser = mutation({
  args: {
    invitedByCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      console.error("No identity found");
      return null;
    }

    // Check if user exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    if (existingUser) {
      console.log("User already exists");
      // Update if needed
      if (
        existingUser.name !== identity.name ||
        existingUser.email !== identity.email ||
        existingUser.image !== identity.pictureUrl
      ) {
        await ctx.db.patch(existingUser._id, {
          name: identity.name,
          email: identity.email,
          image: identity.pictureUrl,
        });
      }
      return existingUser;
    }

    console.log("User does not exist, creating...");
    // Generate unique invite code
    const inviteCode = await generateUniqueInviteCode(ctx);

    // Create new user
    const userId = await ctx.db.insert("users", {
      name: identity.name,
      email: identity.email,
      image: identity.pictureUrl,
      tokenIdentifier: identity.subject,
      inviteCode,
      invitedByCode: args.invitedByCode,
    });

    console.log("User created with invite code:", inviteCode);
    const user = await ctx.db.get(userId);
    console.log("User created", user);
    return user;
  },
});

export const getUserByInviteCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", args.code))
      .unique();
    return user;
  },
});

export const updatePhoneNumber = mutation({
  args: {
    userId: v.id("users"),
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate phone number format (US/Canada: +1XXXXXXXXXX)
    const phoneRegex = /^\+1\d{10}$/;
    if (!phoneRegex.test(args.phoneNumber)) {
      throw new Error("Invalid phone number format. Must be +1XXXXXXXXXX");
    }

    await ctx.db.patch(args.userId, {
      phoneNumber: args.phoneNumber,
    });

    return { success: true };
  },
});
