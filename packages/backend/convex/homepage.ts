import { Client } from "@notionhq/client";
import { v } from "convex/values";
import { action } from "./_generated/server";

export const addEmailToWaitlist = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const notionApiKey = process.env.NOTION_API_KEY;
    const notionDatabaseId = process.env.NOTION_WAITLIST_DATASOURCE_ID;

    if (!notionApiKey) {
      throw new Error("NOTION_API_KEY environment variable not found.");
    }
    if (!notionDatabaseId) {
      throw new Error("NOTION_WAITLIST_DATASOURCE_ID environment variable not found.");
    }

    // Initialize Notion client
    const notion = new Client({ auth: notionApiKey });

    try {
      // Check if email already exists in the database
      const existingPages = await notion.dataSources.query({
        data_source_id: notionDatabaseId,
        filter: {
          property: "Email",
          title: {
            equals: args.email,
          },
        },
      });

      if (existingPages.results.length > 0) {
        return {
          pageId: existingPages.results[0].id,
          alreadyAdded: true,
        };
      }

      // Add new email to the database
      const newPage = await notion.pages.create({
        parent: {
          type: "data_source_id",
          data_source_id: notionDatabaseId,
        },
        properties: {
          Email: {
            title: [
              {
                text: {
                  content: args.email,
                },
              },
            ],
          },
          "Date": {
            date: {
              start: new Date().toISOString(),
            },
          },
        },
      });

      return {
        pageId: newPage.id,
        alreadyAdded: false,
      };
    } catch (error) {
      console.error("Notion API error:", error);
      throw new Error(
        `Failed to add email to waitlist: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});