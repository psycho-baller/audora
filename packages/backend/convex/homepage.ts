import { v } from "convex/values";
import { action } from "./_generated/server";

export const addEmailToWaitlist = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // for more info on how to get the datasource, visit:
    // https://developers.notion.com/docs/working-with-databases
    const notionDatasourceId = process.env.NOTION_WAITLIST_DATASOURCE_ID;
    const notionApiKey = process.env.NOTION_API_KEY;
    if (!notionApiKey) throw new Error("NOTION_API_KEY environment variable not found.");
    if (!notionDatasourceId) throw new Error("NOTION_WAITLIST_DATASOURCE_ID environment variable not found.");

    const date = new Date().toISOString();

    const payload = {
      parent: { type: "data_source_id", data_source_id: notionDatasourceId },
      properties: {
        Email: { type: "title", title: [
          { type: "text", text: { content: args.email } }] },
        "Created Date": {
          date: {
            start: date,
            time_zone: "UTC",
          },
        },
      },
    };

    // creating a new entry in waitlist with email and datetime
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${notionApiKey}`,
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Notion API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return { pageId: data.id }; // the id of the row added
  },
});