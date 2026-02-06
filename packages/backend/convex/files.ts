import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Generates an upload URL for audio files.
 * This is used by the Mac app to upload recordings.
 * Note: Currently public to support the Mac app without full auth integration.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Gets a URL for a stored file by its storage ID.
 * Useful for verifying files were uploaded and getting download URLs.
 */
export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Deletes a file from storage by ID.
 * Used by the Mac app to remove the previous audio file when replacing with a new
 * upload (e.g. after stop/resume), so we keep one file per meeting instead of many.
 */
export const deleteStorageId = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.storageId);
  },
});

/**
 * Lists recent file uploads (for debugging/verification).
 * Note: Convex doesn't have a built-in way to list all files,
 * but you can use this to verify a specific file exists.
 */
export const verifyFileExists = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    try {
      const url = await ctx.storage.getUrl(args.storageId);
      return { exists: true, url };
    } catch {
      return { exists: false, url: null };
    }
  },
});
