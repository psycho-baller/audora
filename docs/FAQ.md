# ❓ Frequently Asked Questions (FAQ)

Common questions about Audora and how to work with the codebase.

## 📋 Table of Contents

1. [General Questions](#general-questions)
2. [Technology Questions](#technology-questions)
3. [Development Questions](#development-questions)
4. [Deployment Questions](#deployment-questions)

---

## 🌟 General Questions

### What is Audora?

Audora is a speech reflection app that helps you improve your communication skills. It records conversations (with consent), transcribes them, and provides AI-powered feedback on your speaking patterns.

### Is this project open source?

Yes! Check the LICENSE file for details.

### Can I use this for my own project?

Yes! Feel free to fork and modify it for your needs.

### Do I need to pay for anything?

The code is free, but you'll need:

- **Free**: Convex, Clerk (generous free tiers)
- **Paid**: OpenAI API (pay-per-use), Speechmatics (free trial, then paid)
- **Optional**: Zep Cloud (for knowledge graph features)

### How much does it cost to run?

**Development**: Essentially free with free tiers

**Production costs** depend on usage:

- OpenAI: ~$0.006 per minute of audio (Whisper)
- Speechmatics: ~$0.025 per minute of audio
- Convex: Free up to 1M function calls/month
- Clerk: Free up to 10K users

### Is my data private?

Yes! The app is designed with privacy in mind:

- Recordings require mutual consent
- Data is stored securely in Convex
- You control your own deployment
- No data is shared with third parties (except AI APIs for processing)

---

## 🔧 Technology Questions

### Why Convex instead of Firebase/Supabase?

Convex offers:

- **Real-time by default**: No manual WebSocket setup
- **Type-safe**: End-to-end TypeScript
- **Serverless**: No server management
- **Built-in file storage**: No need for separate S3
- **Reactive queries**: UI updates automatically

### Why React Router v7 for web?

React Router v7 provides:

- File-based routing (like Next.js)
- Server-side rendering support
- Better performance
- Modern React patterns

### Why Expo for mobile?

Expo makes React Native development much easier:

- No need to open Xcode/Android Studio for development
- Test on real devices with Expo Go
- Built-in modules for camera, audio, etc.
- Easier deployment with EAS

### Can I use npm or yarn instead of pnpm?

Yes, but pnpm is recommended for:

- Faster installs
- Better disk space usage
- Stricter dependency management

To switch, see [GETTING_STARTED.md](./GETTING_STARTED.md).

### Do I need to know TypeScript?

Basic TypeScript knowledge helps, but you can learn as you go. The type system will guide you and catch errors early.

### What's a monorepo?

A monorepo is one repository containing multiple related projects. Benefits:

- Share code between web and mobile
- Make changes across apps in one commit
- Consistent tooling and versions

---

## 💻 Development Questions

### How do I add a new page to the web app?

1. Create a new file in `apps/web/app/routes/`
2. Export a default component
3. Navigate to it!

Example:

```tsx
// apps/web/app/routes/about.tsx
export default function About() {
  return <div>About page</div>;
}
// Now accessible at /about
```

### How do I add a new screen to the mobile app?

1. Create a new file in `apps/expo/app/`
2. Export a default component

Example:

```tsx
// apps/expo/app/settings.tsx
export default function Settings() {
  return <View><Text>Settings</Text></View>;
}
// Now accessible at /settings
```

### How do I add a new table to the database?

1. Edit `packages/backend/convex/schema.ts`
2. Add your table definition
3. Convex will automatically update

Example:

```typescript
export default defineSchema({
  // ... existing tables

  notes: defineTable({
    userId: v.id("users"),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
});
```

### How do I create a new Convex function?

1. Create a new file in `packages/backend/convex/`
2. Export query, mutation, or action functions

Example:

```typescript
// packages/backend/convex/notes.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("notes").collect();
  },
});

export const create = mutation({
  args: { content: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("notes", {
      content: args.content,
      createdAt: Date.now(),
    });
  },
});
```

### How do I use a Convex function in React?

```tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "@audora/backend";

function MyComponent() {
  // Query (read data)
  const notes = useQuery(api.notes.list);

  // Mutation (write data)
  const createNote = useMutation(api.notes.create);

  const handleCreate = async () => {
    await createNote({ content: "Hello!" });
  };

  return (
    <div>
      {notes?.map(note => (
        <div key={note._id}>{note.content}</div>
      ))}
      <button onClick={handleCreate}>Create</button>
    </div>
  );
}
```

### How do I add a new environment variable?

1. Add to `.env.local` file
2. Restart dev server
3. Access in code:
   - Web: `import.meta.env.VITE_MY_VAR`
   - Mobile: `process.env.EXPO_PUBLIC_MY_VAR`
   - Backend: Set via `npx convex env set MY_VAR "value"`

### How do I debug Convex functions?

```typescript
export const myFunction = query({
  handler: async (ctx) => {
    console.log("Debug info:", someValue);
    // Logs appear in: npx convex logs
  },
});
```

Then run: `npx convex logs`

### How do I test my changes?

**Manual testing**:

1. Make changes
2. Check the app
3. Verify it works

**Automated testing** (not set up yet):

- Unit tests: Jest
- E2E tests: Playwright (web), Detox (mobile)

### Can I use a different UI library?

Yes! The project uses:

- Web: shadcn/ui (Radix UI + Tailwind)
- Mobile: Custom components with NativeWind

You can replace with Material-UI, Chakra, etc.

### How do I add authentication to a Convex function?

```typescript
import { query } from "./_generated/server";

async function getUserId(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .unique();

  if (!user) throw new Error("User not found");
  return user._id;
}

export const mySecureBackendFunction = query({
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    // Now you have the authenticated user ID
  },
});
```

---

## 🚀 Deployment Questions

### How do I deploy to production?

**Backend (Convex)**:

```bash
cd packages/backend
npx convex deploy --prod
```

**Web app**:

- Deploy to Vercel, Netlify, or any Node.js host
- Set environment variables in hosting platform

**Mobile app**:

- Use EAS Build to create app binaries
- Submit to App Store / Play Store

### Can I self-host this?

**Backend**: Convex is a hosted service (no self-hosting)

**Frontend**: Yes, you can host the web/mobile apps anywhere

**Alternative**: Replace Convex with your own backend (requires significant refactoring)

### How do I set up a production database?

Convex automatically provides production databases. Just deploy:

```bash
cd packages/backend
npx convex deploy --prod
```

### How do I handle environment variables in production?

**Web app** (Vercel example):

1. Go to project settings
2. Add environment variables
3. Redeploy

**Mobile app**:

1. Use EAS Secrets: `eas secret:create`
2. Or use `.env.production` file

**Backend**:

```bash
npx convex env set --prod MY_VAR "value"
```

### How much traffic can this handle?

Convex scales automatically. The free tier includes:

- 1M function calls/month
- 1GB database storage
- 1GB file storage

Paid plans scale to millions of users.

### How do I monitor production?

**Convex**:

- Dashboard: <https://dashboard.convex.dev>
- Logs: `npx convex logs --prod`
- Metrics: Built into dashboard

**Web app**:

- Use Vercel Analytics or Google Analytics
- Set up error tracking (Sentry, etc.)

### Can I use a custom domain?

**Web app**: Yes, configure in your hosting platform

**Convex**: Uses `*.convex.cloud` domain (custom domains not supported)

### How do I backup my data?

**Convex**:

- Export data: `npx convex export`
- Automatic backups included in paid plans

**Best practice**: Regular exports to your own storage

---

## 🤔 Common Confusions

### Why are there two package.json files?

This is a monorepo. Each package has its own `package.json`:

- Root: Workspace configuration and scripts
- Each app/package: Its own dependencies

### What's the difference between query, mutation, and action?

- **Query**: Read data (can't modify database)
- **Mutation**: Write data (can modify database)
- **Action**: Call external APIs (can do anything)

### Why do I need both Clerk and Convex?

- **Clerk**: Handles authentication UI and user management
- **Convex**: Stores your data and runs backend logic
- They work together: Clerk authenticates, Convex authorizes

### What's the _generated folder?

Convex automatically generates TypeScript types for your functions. Never edit these files manually!

### Why workspace:* in dependencies?

This tells pnpm to use the local package instead of downloading from npm.

### Can I use this without AI features?

Yes! The core conversation recording and transcription works without AI. AI features are optional enhancements.

---

## 📚 Still Have Questions?

- Check [Getting Started Guide](./GETTING_STARTED.md)
- Read [Architecture Overview](./ARCHITECTURE.md)
- See [Troubleshooting Guide](./TROUBLESHOOTING.md)
- Check official docs:
  - [Convex](https://docs.convex.dev/)
  - [React](https://react.dev/)
  - [React Native](https://reactnative.dev/)
  - [Expo](https://docs.expo.dev/)

---

**Can't find your answer?** Open an issue on GitHub or ask in the Convex Discord!
