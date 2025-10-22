# 🏗️ Architecture Overview

This document explains the technical architecture of Audora for developers who are new to the tech stack.

## 📋 Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Monorepo Structure](#monorepo-structure)
3. [Technology Deep Dive](#technology-deep-dive)
4. [Data Flow](#data-flow)
5. [Key Concepts](#key-concepts)

---

## 🎯 High-Level Architecture

Audora uses a **modern full-stack architecture** with three main layers:

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │   Web App        │      │   Mobile App     │        │
│  │  (React Router)  │      │  (React Native)  │        │
│  └──────────────────┘      └──────────────────┘        │
└─────────────────────────────────────────────────────────┘
                         │
                         ↓ (Real-time WebSocket + HTTP)
┌─────────────────────────────────────────────────────────┐
│                   BACKEND LAYER                          │
│              ┌──────────────────┐                        │
│              │     Convex       │                        │
│              │  (BaaS Platform) │                        │
│              └──────────────────┘                        │
│         Database + API + Real-time + Storage             │
└─────────────────────────────────────────────────────────┘
                         │
                         ↓ (API Calls)
┌─────────────────────────────────────────────────────────┐
│                 EXTERNAL SERVICES                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐│
│  │  Clerk   │  │  OpenAI  │  │Speechmat.│  │   Zep   ││
│  │  (Auth)  │  │   (AI)   │  │  (STT)   │  │ (Graph) ││
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘│
└─────────────────────────────────────────────────────────┘
```

### Key Characteristics

- **Serverless**: No servers to manage, Convex handles scaling
- **Real-time**: Live updates via WebSocket connections
- **Type-safe**: End-to-end TypeScript for safety
- **Cross-platform**: Shared code between web and mobile

---

## 📦 Monorepo Structure

This project uses a **monorepo** managed by **Turborepo** and **pnpm workspaces**.

### What is a Monorepo?

A monorepo is a single repository containing multiple related projects. Benefits:

- **Code sharing**: Reuse components and logic across apps
- **Atomic changes**: Update multiple apps in one commit
- **Consistent tooling**: Same build tools everywhere
- **Easier refactoring**: Change shared code with confidence

### Workspace Layout

```
audora/
├── apps/                    # Applications (end-user facing)
│   ├── web/                # Web application
│   └── expo/               # Mobile application
│
├── packages/               # Shared packages (libraries)
│   ├── backend/           # Convex backend functions
│   ├── ui/                # Shared UI components
│   ├── tailwind-config/   # Shared styling configuration
│   ├── feature-home/      # Shared feature logic
│   └── eslint-config/     # Shared linting rules
│
├── docs/                   # Documentation
├── package.json           # Root package (scripts & workspace config)
├── pnpm-workspace.yaml    # Workspace definition
└── turbo.json            # Turborepo build configuration
```

### How Workspaces Work

Each package has its own `package.json`. Packages can depend on each other:

```json
{
  "dependencies": {
    "@audora/backend": "workspace:*",
    "@audora/ui": "workspace:*"
  }
}
```

The `workspace:*` protocol tells pnpm to link to the local package.

---

## 🔧 Technology Deep Dive

### Frontend Technologies

#### React (Web) & React Native (Mobile)

**What is React?**

- A JavaScript library for building user interfaces
- Uses a component-based architecture
- Efficiently updates the UI when data changes

**Key Concepts:**

1. **Components**: Reusable UI building blocks

   ```tsx
   function Button({ text, onClick }) {
     return <button onClick={onClick}>{text}</button>;
   }
   ```

2. **Props**: Data passed to components

   ```tsx
   <Button text="Click me" onClick={handleClick} />
   ```

3. **State**: Data that changes over time

   ```tsx
   const [count, setCount] = useState(0);
   ```

4. **Hooks**: Functions that let you use React features
   - `useState`: Manage component state
   - `useEffect`: Run side effects
   - `useQuery`: Fetch data from Convex (custom hook)

**React Native** is the same as React, but for mobile apps. Instead of HTML elements, it uses native mobile components.

#### React Router v7 (Web Navigation)

Handles navigation between pages in the web app.

**File-based routing**: Each file in `app/routes/` becomes a route:

- `app/routes/_index.tsx` → `/`
- `app/routes/record.tsx` → `/record`
- `app/routes/record.$id.tsx` → `/record/:id`

This is configured in the [app/routes/index.tsx](apps/web/app/routes.ts) file.

#### Expo (Mobile Development)

Expo is a framework that makes React Native development easier:

- **Expo Go**: Test app on your phone without building
- **Expo Router**: File-based navigation for mobile
- **Expo Modules**: Native functionality (camera, audio, etc.)

#### TailwindCSS (Styling)

A utility-first CSS framework. Instead of writing CSS classes:

```tsx
// Traditional CSS
<div className="my-custom-button">Click me</div>

// Tailwind CSS
<div className="bg-blue-500 text-white px-4 py-2 rounded">
  Click me
</div>
```

Benefits:

- Fast development
- Consistent design
- No CSS file management

---

### Backend Technology: Convex

#### What is Convex?

Convex is a **Backend-as-a-Service (BaaS)** platform that provides:

1. **Database**: Store and query data
2. **API**: Automatically generated from your functions
3. **Real-time**: Live updates via WebSocket (by default)
4. **File Storage**: Store audio files
5. **Authentication**: Integration with Clerk

#### Key Concepts

##### 1. Schema

Defines your database structure ([packages/backend/convex/schema.ts](packages/backend/convex/schema.ts)):

```typescript
// packages/backend/convex/schema.ts
export default defineSchema({
  conversations: defineTable({
    initiatorUserId: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("ended")
    ),
    summary: v.optional(v.string()),
  })
    .index("by_initiator", ["initiatorUserId"])
});
```

This creates a `conversations` table with fields and indexes.

##### 2. Queries

Read data from the database (read-only) ([packages/backend/convex/conversations.ts](packages/backend/convex/conversations.ts)):

```typescript
// packages/backend/convex/conversations.ts
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await ctx.auth.getUserIdentity();
    return await ctx.db
      .query("conversations")
      .withIndex("by_initiator", (q) => q.eq("initiatorUserId", userId))
      .collect();
  },
});
```

**Use in React:**

```tsx
const conversations = useQuery(api.conversations.list);
```

The component automatically re-renders when data changes!

##### 3. Mutations

Modify data in the database ([packages/backend/convex/conversations.ts](packages/backend/convex/conversations.ts)):

```typescript
export const create = mutation({
  args: { location: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserIdentity();
    const inviteCode = generateCode();

    return await ctx.db.insert("conversations", {
      initiatorUserId: userId,
      status: "pending",
      inviteCode,
      location: args.location,
    });
  },
});
```

**Use in React:**

```tsx
const createConversation = useMutation(api.conversations.create);
await createConversation({ location: "Office" });
```

##### 4. Actions

Call external APIs or run long-running tasks ([packages/backend/convex/conversations.ts](packages/backend/convex/conversations.ts)):

```typescript
export const transcribeAudio = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    // Get file from storage
    const url = await ctx.storage.get(args.storageId);

    // Call OpenAI API
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(url),
      model: "whisper-1",
    });

    // Save results via mutation
    await ctx.runMutation(api.conversations.saveTranscript, {
      text: transcription.text,
    });
  },
});
```

Actions can:

- Call external APIs (OpenAI, Speechmatics)
- Run for longer than queries/mutations
- Call mutations to save results

##### 5. HTTP Endpoints

Handle webhooks and external requests ([packages/backend/convex/http.ts](packages/backend/convex/http.ts)):

```typescript
// packages/backend/convex/http.ts
export default httpRouter();

http.route({
  path: "/webhook/clerk",
  method: "POST",
  handler: async (ctx, request) => {
    const body = await request.json();
    // Process webhook
    return new Response("OK", { status: 200 });
  },
});
```

---

### Authentication: Clerk

Clerk handles user authentication:

1. **Sign-up/Sign-in UI**: Pre-built components
2. **Session management**: Automatic token handling
3. **User profiles**: Store user data
4. **OAuth**: Google, GitHub, etc.

**How it works:**

1. User signs in via Clerk UI
2. Clerk generates a JWT token
3. Token is sent with every Convex request
4. Convex validates token and identifies user

**In your code:**

```tsx
// Get current user in Convex (backend)
const userId = await ctx.auth.getUserIdentity();

// In React
const { user } = useUser(); // From Clerk
```

---

## 🔄 Data Flow

### Example: Recording a Conversation

Let's trace how data flows through the system:

#### Step 1: User Starts Recording

```tsx
// apps/web/app/routes/record.tsx
const createConversation = useMutation(api.conversations.create);

async function handleStart() {
  const id = await createConversation({ location: "Office" });
  navigate(`/record/${id}`);
}
```

#### Step 2: Convex Creates Conversation

```typescript
// packages/backend/convex/conversations.ts
export const create = mutation({
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const inviteCode = generateCode();

    const id = await ctx.db.insert("conversations", {
      initiatorUserId: identity.userId,
      status: "pending",
      inviteCode,
      location: args.location,
      startedAt: Date.now(),
    });

    return id;
  },
});
```

#### Step 3: Show QR Code

```tsx
// apps/web/app/routes/record.$id.tsx
const conversation = useQuery(api.conversations.get, { id });

if (conversation.status === "pending") {
  return <QRCode value={`${url}/join/${conversation.inviteCode}`} />;
}
```

#### Step 4: Friend Scans QR Code

```tsx
// apps/web/app/routes/join.$code.tsx
const claimScanner = useMutation(api.conversations.claimScanner);

async function handleJoin() {
  await claimScanner({ inviteCode: code });
}
```

#### Step 5: Real-time Update

Both users' UIs automatically update because they're using `useQuery`:

```tsx
// Automatically re-renders when status changes!
const conversation = useQuery(api.conversations.get, { id });

if (conversation.status === "active") {
  return <RecordingInterface />;
}
```

#### Step 6: Upload Audio

```tsx
const uploadAudio = useMutation(api.conversations.uploadAudio);

async function handleStop(audioBlob) {
  const storageId = await uploadAudio({
    conversationId: id,
    audio: audioBlob
  });
}
```

#### Step 7: Process with AI (Action)

```typescript
// Automatically triggered after upload
export const processAudio = internalAction({
  handler: async (ctx, { storageId, conversationId }) => {
    // 1. Transcribe with Speechmatics
    const transcript = await transcribeAudio(storageId);

    // 2. Analyze with GPT-4
    const analysis = await analyzeTranscript(transcript);

    // 3. Save results
    await ctx.runMutation(api.conversations.saveResults, {
      conversationId,
      transcript,
      analysis,
    });
  },
});
```

#### Step 8: Display Results

```tsx
// UI automatically updates with results!
const conversation = useQuery(api.conversations.get, { id });

return (
  <div>
    <h2>Summary</h2>
    <p>{conversation.summary}</p>

    <h2>Transcript</h2>
    {conversation.transcript.map(turn => (
      <p key={turn.id}>{turn.text}</p>
    ))}
  </div>
);
```

---

## 🧠 Key Concepts

### Real-time Updates

Convex provides **reactive queries** - your UI automatically updates when data changes:

```tsx
// This component re-renders whenever conversations change
function ConversationList() {
  const conversations = useQuery(api.conversations.list);

  return (
    <ul>
      {conversations?.map(conv => (
        <li key={conv._id}>{conv.summary}</li>
      ))}
    </ul>
  );
}
```

No need for:

- Manual polling
- WebSocket management
- Cache invalidation

Convex handles it all!

### Type Safety

TypeScript ensures type safety across the stack:

```typescript
// Backend defines types
export const create = mutation({
  args: { location: v.string() },
  handler: async (ctx, args) => {
    // args.location is typed as string
  },
});

// Frontend gets automatic types
const create = useMutation(api.conversations.create);
await create({ location: "Office" }); // ✅ Type-safe
await create({ location: 123 }); // ❌ TypeScript error
```

### File Storage

Convex provides built-in file storage:

```typescript
// Upload
const storageId = await ctx.storage.store(blob);

// Get URL
const url = await ctx.storage.get(storageId);

// Delete
await ctx.storage.delete(storageId);
```

Files are automatically:

- Stored in the cloud
- Served via CDN
- Cleaned up when deleted

---

## 🎓 Learning Resources

### Convex

- [Quickstart](https://docs.convex.dev/quickstart)
- [Database Queries](https://docs.convex.dev/database/reading-data)
- [Mutations](https://docs.convex.dev/database/writing-data)
- [Actions](https://docs.convex.dev/functions/actions)

### React

- [React Tutorial](https://react.dev/learn)
- [Hooks Reference](https://react.dev/reference/react)

### React Native

- [Getting Started](https://reactnative.dev/docs/getting-started)
- [Expo Documentation](https://docs.expo.dev/)

### TypeScript

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

---

## 🔍 Next Steps

Now that you understand the architecture:

1. **Explore the code**: Start with simple queries and mutations
2. **Make changes**: Try adding a new field to the schema
3. **Build features**: Create a new page or component
4. **Read the docs**: Deep dive into specific technologies
