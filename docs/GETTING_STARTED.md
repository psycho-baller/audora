# 🚀 Getting Started with Audora (LinkMaxxing)

Welcome! This guide will help you set up and run the Audora project from scratch, even if you're completely new to React, React Native, or Convex.

## 📚 Table of Contents

1. [What is Audora?](#what-is-audora)
2. [What You'll Need](#what-youll-need)
3. [Understanding the Tech Stack](#understanding-the-tech-stack)
4. [Step-by-Step Setup](#step-by-step-setup)
5. [Running the Project](#running-the-project)
6. [Understanding the Project Structure](#understanding-the-project-structure)
7. [Next Steps](#next-steps)

---

## 🎯 What is Audora?

Audora is a **speech reflection app** that helps you become a better communicator. It:

- **Records conversations** with your consent and the other person's consent
- **Transcribes** what was said using AI
- **Analyzes** your speech patterns (filler words, pacing, clarity, confidence)
- **Provides feedback** to help you improve your communication skills
- **Remembers** key facts about your conversations and relationships

Think of it as a personal communication coach that helps you "maxx out how you link" with others!

---

## 💻 What You'll Need

### Required Software

Before starting, you need to install these tools on your computer:

1. **Node.js** (version 18 or higher)
   - Download from: <https://nodejs.org/>
   - This is a JavaScript runtime that lets you run the project
   - Check if installed: Open terminal and type `node --version`

2. **pnpm** (Package Manager)
   - Install after Node.js: `npm install -g pnpm`
   - This manages all the project's dependencies
   - Check if installed: `pnpm --version`

3. **Git** (Version Control)
   - Download from: <https://git-scm.com/>
   - This helps you download and manage the code
   - Check if installed: `git --version`

4. **UNIX Shell** (Terminal)
   - This is a command-line interface that lets you run commands
   - Check if installed: Open terminal and type `echo $SHELL`

### For Mobile Development (Optional)

If you want to run the mobile app:

- **For iOS**: Mac computer with Xcode installed
- **For Android**: Android Studio installed
- **Expo Go App (optional)**: Download on your phone from App Store/Play Store

### Required Accounts (Free)

You'll need to create free accounts for these services:

1. **Convex** (Backend Database)
   - Sign up at: <https://convex.dev/>
   - This is where your data is stored

2. **Clerk** (Authentication)
   - Sign up at: <https://clerk.com/>
   - This handles user login/signup

3. **OpenAI** (AI Processing)
   - Sign up at: <https://platform.openai.com/>
   - This provides AI transcription and analysis
   - Note: Requires payment for API usage

4. **Speechmatics** (Speech Recognition)
   - Sign up at: <https://www.speechmatics.com/>
   - This transcribes audio to text
   - Free trial available

---

## 🧠 Understanding the Tech Stack

Before diving in, let's understand what technologies this project uses:

### **Monorepo Structure**

This project uses a "monorepo" - one repository containing multiple related projects:

- **Web app** (runs in browser)
- **Mobile app** (runs on iOS/Android)
- **Backend** (Convex functions)
- **Shared packages** (code used by both apps)

### **Key Technologies**

#### **Frontend (What Users See)**

1. **React** (Web)
   - A JavaScript library for building user interfaces
   - Think of it as building blocks for websites
   - Official docs: <https://react.dev/>

2. **React Native** (Mobile)
   - Like React, but for mobile apps
   - Write once, run on iOS and Android
   - Official docs: <https://reactnative.dev/>

3. **Expo** (Mobile Development Platform)
   - Makes React Native development easier
   - Provides tools and services for mobile apps
   - Official docs: <https://docs.expo.dev/>

4. **React Router v7** (Web Navigation)
   - Handles navigation between pages on the web app
   - Official docs: <https://reactrouter.com/>

5. **TailwindCSS** (Styling)
   - A utility-first CSS framework for styling
   - Makes it easy to create beautiful UIs
   - Official docs: <https://tailwindcss.com/>

#### **Backend (What Happens Behind the Scenes)**

1. **Convex** (Backend Platform)
   - A backend-as-a-service platform
   - Handles database, real-time updates, and server functions
   - No need to manage servers yourself!
   - Official docs: <https://docs.convex.dev/>

2. **Clerk** (Authentication)
   - Handles user login, signup, and security
   - Provides ready-made UI components
   - Official docs: <https://clerk.com/docs>

#### **AI Services**

1. **OpenAI Whisper** (Speech-to-Text)
   - Converts audio recordings to text
   - Very accurate transcription

2. **OpenAI GPT-5** (Analysis)
   - Analyzes conversations
   - Extracts facts and insights

3. **Speechmatics** (Real-time Transcription)
   - Transcribes speech in real-time
   - Identifies different speakers

#### **Build Tools**

1. **Turborepo** (Monorepo Management)
   - Manages multiple projects in one repository
   - Makes builds faster with caching

2. **pnpm** (Package Manager)
   - Installs and manages dependencies
   - Faster and more efficient than npm

---

## 🛠️ Step-by-Step Setup

### Step 1: Clone the Repository

Open your terminal and run:

```bash
# Navigate to where you want the project
cd ~/Documents/code

# Clone the repository
git clone <your-repo-url>
cd audora
```

### Step 2: Install Dependencies

This will install all the packages needed for the project:

```bash
pnpm install
```

This might take a few minutes. You'll see a lot of text scrolling - that's normal!

### Step 3: Set Up Convex (Backend)

Convex is your backend database and API. Let's set it up:

```bash
# Install Convex CLI globally
npm install -g convex

# Login to Convex (opens browser)
npx convex login

# Initialize Convex in the backend package
cd packages/backend
npx convex dev
```

This will:

- Create a new Convex project
- Generate a deployment URL
- Start watching for changes

**Important**: Keep this terminal window open! Copy the `CONVEX_URL` that appears - you'll need it next.

### Step 4: Set Up Clerk (Authentication)

1. Go to <https://clerk.com/> and sign up
2. Create a new application
3. Choose "Email" and "Google" as sign-in methods
4. Copy your **Publishable Key** and **Secret Key**

### Step 5: Configure Environment Variables

You need to create configuration files that tell the apps where to find your services.

#### For the Web App

Copy the example file and fill in your values:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Then edit `apps/web/.env.local` with your actual values:

```env
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_CLERK_FRONTEND_API_URL=https://your-clerk-frontend-api.clerk.accounts.dev

CLERK_SECRET_KEY=sk_test_xxxxx
```

**Note**: See `apps/web/.env.example` for all required variables.

#### For the Mobile App

Copy the example file and fill in your values:

```bash
cp apps/expo/.env.example apps/expo/.env.local
```

Then edit `apps/expo/.env.local` with your actual values:

```env
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
```

**Note**: Mobile apps use `EXPO_PUBLIC_` prefix for environment variables.

#### For the Backend

The backend needs API keys set in Convex environment. See `packages/backend/.env.example` for all available variables.

Set the required API keys:

```bash
cd packages/backend

# Set OpenAI API key
npx convex env set OPENAI_API_KEY "sk-xxxxx"

# Set Speechmatics API key (optional)
npx convex env set SPEECHMATICS_API_KEY "your_key"

# Set Zep API key (optional, for knowledge graph)
npx convex env set ZEP_API_KEY "your_zep_key"
npx convex env set ZEP_GRAPH_ID "your_graph_id"

# Set VAPI keys (optional, for voice calls)
npx convex env set VAPI_API_KEY "your_vapi_key"
npx convex env set VAPI_PHONE_NUMBER_ID "your_phone_number_id"
npx convex env set VAPI_WORKFLOW_ID "your_workflow_id"
```

**Note**: Only `OPENAI_API_KEY` is required. Other keys are optional depending on which features you want to use.

### Step 6: Configure Clerk with Convex

You need to connect Clerk to Convex:

1. In your Clerk dashboard, go to **JWT Templates**
2. Create a new template called "convex"
3. Copy the JWKS endpoint URL
4. In your Convex dashboard, go to **Settings** → **Authentication**
5. Add Clerk as an authentication provider using the JWKS URL

---

## 🏃 Running the Project

Now you're ready to run the project!

### Option 1: Run Everything at Once

From the root directory:

```bash
pnpm dev
```

This starts:

- Web app at `http://localhost:5173`
- Mobile app (Expo)
- Backend (Convex)

### Option 2: Run Individual Apps

You can run each app separately:

#### Run Web App Only

```bash
pnpm dev:web
```

Then open `http://localhost:5173` in your browser.

#### Run Mobile App Only

```bash
pnpm dev:expo
```

Then:

- Scan the QR code with Expo Go app on your phone, OR
- Press `i` for iOS simulator, OR
- Press `a` for Android emulator

#### Run Backend Only

```bash
pnpm dev:backend
```

---

## 📁 Understanding the Project Structure

Here's what each folder contains:

```
audora/
├── apps/                          # Applications
│   ├── web/                      # Web application (React Router)
│   │   ├── app/                  # App code
│   │   │   ├── routes/          # Page routes
│   │   │   └── components/      # Reusable UI components
│   │   └── package.json         # Web dependencies
│   │
│   └── expo/                     # Mobile application (React Native)
│       ├── app/                  # App code
│       │   ├── (tabs)/          # Tab navigation screens
│       │   └── (auth)/          # Authentication screens
│       ├── components/           # Reusable mobile components
│       └── package.json         # Mobile dependencies
│
├── packages/                      # Shared packages
│   ├── backend/                  # Convex backend
│   │   └── convex/              # Convex functions
│   │       ├── schema.ts        # Database schema
│   │       ├── conversations.ts # Conversation functions
│   │       ├── transcription.ts # AI transcription
│   │       └── analytics.ts     # Speech analytics
│   │
│   ├── ui/                       # Shared UI components
│   ├── tailwind-config/          # Shared styling config
│   └── feature-home/             # Shared feature code
│
├── docs/                          # Documentation
├── package.json                   # Root package config
├── pnpm-workspace.yaml           # Monorepo config
└── turbo.json                    # Build system config
```

### Key Files to Know

- **`package.json`**: Lists dependencies and scripts for each package
- **`schema.ts`**: Defines your database structure (tables and fields)
- **`convex/`**: Contains all backend functions (queries, mutations, actions)
- **`app/routes/`**: Web app pages
- **`app/(tabs)/`**: Mobile app screens

---

## 🎓 Next Steps

### Learn the Basics

1. **Convex Basics**
   - Read: <https://docs.convex.dev/quickstart>
   - Learn about queries, mutations, and actions
   - Understand how real-time updates work

2. **React Basics** (if new to React)
   - Tutorial: <https://react.dev/learn>
   - Learn about components, props, and state
   - Understand hooks like `useState` and `useEffect`

3. **React Native Basics** (if building mobile)
   - Tutorial: <https://reactnative.dev/docs/getting-started>
   - Learn about mobile-specific components
   - Understand navigation

### Explore the Codebase

Start with these files to understand how things work:

1. **Database Schema**: `packages/backend/convex/schema.ts`
   - See what data is stored

2. **Web Home Page**: `apps/web/app/routes/_index.tsx`
   - See how the web app works

3. **Mobile Home Screen**: `apps/expo/app/(tabs)/index.tsx`
   - See how the mobile app works

4. **Conversation Functions**: `packages/backend/convex/conversations.ts`
   - See how conversations are created and managed

### Try Making Changes

1. **Change a Text Label**
   - Find a component
   - Change some text
   - See it update in the app

2. **Add a New Field to the Database**
   - Edit `schema.ts`
   - Add a field to a table
   - Use it in a query

3. **Create a New Page**
   - Add a new route file
   - Create a simple component
   - Navigate to it

### Common Development Tasks

#### View Convex Logs

```bash
cd packages/backend
npx convex logs
```

#### View Database Data

```bash
cd packages/backend
npx convex dashboard
```

#### Reset Database (if needed)

```bash
cd packages/backend
npx convex data clear
```

#### Build for Production

```bash
pnpm build
```

---

## 🆘 Getting Help

### Documentation

- **This Project**: Check the `/docs` folder for feature-specific guides
- **Convex**: <https://docs.convex.dev/>
- **React**: <https://react.dev/>
- **React Native**: <https://reactnative.dev/>
- **Expo**: <https://docs.expo.dev/>

### Troubleshooting

If something doesn't work:

1. **Check the terminal** for error messages
2. **Check the browser console** (F12 in browser)
3. **Check Convex logs**: `npx convex logs`
4. **Try restarting** the dev server
5. **Reset the project**: `pnpm reset` (clears caches and reinstalls)
6. **Full reset** if needed: `pnpm reset:full` (also removes lock file)

### Common Issues

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for solutions to common problems.

---

## 🎉 You're Ready

You now have:

- ✅ The project running locally
- ✅ Understanding of the tech stack
- ✅ Knowledge of the project structure
- ✅ Resources to learn more

Start exploring the code, make changes, and build something amazing!

**Happy coding! 🚀**
