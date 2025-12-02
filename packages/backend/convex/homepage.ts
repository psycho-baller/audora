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

    const checkEmailPayload = {
      filter: {
        property: "Email",
        email: {
          contains: args.email
        }
      }
    }
    
    // should prolly create an interface for this and "deserialize" the response
    const checkEmailResponse = await fetch(`https://api.notion.com/v1/data_sources/${notionDatasourceId}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${notionApiKey}`,
        "Notion-Version": "2025-09-03",
      },
      body: JSON.stringify(checkEmailPayload),
    })
    
    if (!checkEmailResponse.ok) {
      const text = await checkEmailResponse.text();
      throw new Error(`Notion API error ${checkEmailResponse.status}: ${text}`);
    }

    const checkEmailData = await checkEmailResponse.json();
    if (checkEmailData.results.length > 0) {
      return { pageId: checkEmailData.results[0].id, alreadyAdded: true };
    }
    
    const date = new Date().toISOString();

    const addEmailPayload = {
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
    const addEmailResponse = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${notionApiKey}`,
        "Notion-Version": "2022-06-28", // we should prolly update this to the 2025-09-03 version, for now it works
      },
      body: JSON.stringify(addEmailPayload),
    });

    if (!addEmailResponse.ok) {
      const text = await addEmailResponse.text();
      throw new Error(`Notion API error ${addEmailResponse.status}: ${text}`);
    }

    const addEmailData = await addEmailResponse.json();
    return { pageId: addEmailData.id, alreadyAdded: false }; // the id of the row added
  },
});