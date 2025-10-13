import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { VapiClient } from "@vapi-ai/server-sdk";

// Helper to get current user
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

// Update user's phone number
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

// Get user's phone number
export const getPhoneNumber = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user?.phoneNumber ?? null;
  },
});

// Initiate VAPI call
export const initiateCall = action({
  args: {
    contactUserId: v.id("users"),
    phoneNumber: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    callId: string;
    phoneNumber: string;
  }> => {
    // Get contact details
    const contact = await ctx.runQuery(api.users.get, { id: args.contactUserId });

    if (!contact) {
      throw new Error("Contact not found");
    }

    // Use provided phone number or get from contact
    const phoneNumber: string | null | undefined = args.phoneNumber || contact.phoneNumber;

    if (!phoneNumber) {
      throw new Error("No phone number available for this contact");
    }

    // Validate phone number format
    const phoneRegex = /^\+1\d{10}$/;
    if (!phoneRegex.test(phoneNumber)) {
      throw new Error("Invalid phone number format. Must be +1XXXXXXXXXX");
    }

    // If phone number was provided and different from stored, update it
    if (args.phoneNumber && args.phoneNumber !== contact.phoneNumber) {
      await ctx.runMutation(api.users.updatePhoneNumber, {
        userId: args.contactUserId,
        phoneNumber: args.phoneNumber,
      });
    }

    // Validate environment variables
    if (!process.env.VAPI_API_KEY) {
      throw new Error("VAPI_API_KEY is not configured");
    }
    if (!process.env.VAPI_PHONE_NUMBER_ID) {
      throw new Error("VAPI_PHONE_NUMBER_ID is not configured");
    }
    if (!process.env.VAPI_WORKFLOW_ID) {
      throw new Error("VAPI_WORKFLOW_ID is not configured");
    }

    // Initialize VAPI client
    const vapi = new VapiClient({
      token: process.env.VAPI_API_KEY,
    });

    try {
      // Initiate the call
      const response = await vapi.calls.create({
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        customer: {
          name: contact.name || "Unknown",
          number: phoneNumber,
        },
        workflowId: process.env.VAPI_WORKFLOW_ID,
      });

      // Extract call ID from response
      // VAPI SDK returns different response types, so we handle both
      let callId: string | undefined;
      
      if (response && typeof response === 'object') {
        callId = (response as any).id || (response as any).callId;
      }
      
      if (!callId) {
        throw new Error("VAPI did not return a call ID");
      }

      return {
        success: true,
        callId: callId,
        phoneNumber,
      };
    } catch (error: any) {
      console.error("VAPI call error:", error);
      const errorMessage = error.message || "Unknown error occurred";
      throw new Error(`Failed to initiate call: ${errorMessage}`);
    }
  },
});
