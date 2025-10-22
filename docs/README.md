# 📚 Audora Documentation Index

Welcome to the Audora documentation! This guide will help you get started with the project.

## 🚀 Getting Started

### For Absolute Beginners

Start here if you're new to React, React Native, or Convex:

- **[Complete Getting Started Guide](../GETTING_STARTED.md)** - Step-by-step setup from scratch
  - What is Audora?
  - Prerequisites and installation
  - Understanding the tech stack
  - Complete setup instructions
  - Project structure explanation

### For Experienced Developers

Quick setup guides for specific platforms:

- **[Web App Quick Start](./QUICK_START_WEB.md)** - Run the web app in 10 minutes
- **[Mobile App Quick Start](./QUICK_START_MOBILE.md)** - Run the mobile app in 10 minutes

---

## 📖 Core Documentation

### Understanding the Project

- **[Main README](../README.md)** - Project overview and features
  - What Audora does
  - Feature list
  - Quick start
  - Tech stack

- **[Architecture Overview](../ARCHITECTURE.md)** - Deep dive into the tech stack
  - High-level architecture
  - Monorepo structure
  - Technology explanations
  - Data flow examples
  - Key concepts

### Setup & Configuration

- **[Setup Instructions](./SETUP_INSTRUCTIONS.md)** - Quick configuration guide
  - Environment variables
  - API keys setup
  - Running the app

---

## 🐛 Troubleshooting & Help

- **[Troubleshooting Guide](../TROUBLESHOOTING.md)** - Solutions to common problems
  - Installation issues
  - Convex issues
  - Authentication problems
  - Build errors
  - Mobile app issues
  - API errors

- **[FAQ](../FAQ.md)** - Frequently asked questions
  - General questions
  - Technology questions
  - Development questions
  - Deployment questions

---

## 📱 Platform-Specific Guides

### Web App

- **Location**: `apps/web/`
- **Framework**: React Router v7
- **Quick Start**: [QUICK_START_WEB.md](./QUICK_START_WEB.md)
- **Environment**: Copy `apps/web/.env.example` to `apps/web/.env.local`

### Mobile App

- **Location**: `apps/expo/`
- **Framework**: React Native + Expo
- **Quick Start**: [QUICK_START_MOBILE.md](./QUICK_START_MOBILE.md)
- **Environment**: Copy `apps/expo/.env.example` to `apps/expo/.env.local`

### Backend

- **Location**: `packages/backend/`
- **Platform**: Convex
- **Environment**: See `packages/backend/.env.example` for available variables
- **Key Files**:
  - `convex/schema.ts` - Database schema
  - `convex/conversations.ts` - Conversation functions
  - `convex/transcription.ts` - AI processing

---

## 🎓 Learning Path

### For Beginners

1. Start with [Getting Started Guide](../GETTING_STARTED.md)
2. Read [Architecture Overview](../ARCHITECTURE.md)
3. Follow a [Quick Start Guide](./QUICK_START_WEB.md)
4. Explore the codebase
5. Try making small changes

### External Resources

- **Convex**: <https://docs.convex.dev/>
- **React**: <https://react.dev/>
- **React Native**: <https://reactnative.dev/>
- **Expo**: <https://docs.expo.dev/>
- **React Router**: <https://reactrouter.com/>
- **TypeScript**: <https://www.typescriptlang.org/>

---

## 🗺️ Documentation Structure

```
audora/
├── README.md                      # Main project overview
├── GETTING_STARTED.md            # Complete beginner's guide
├── ARCHITECTURE.md               # Tech stack deep dive
├── TROUBLESHOOTING.md            # Common issues & solutions
├── FAQ.md                        # Frequently asked questions
│
└── docs/
    ├── README.md                 # This file (documentation index)
    ├── QUICK_START_WEB.md       # Web app quick start
    ├── QUICK_START_MOBILE.md    # Mobile app quick start
    └── SETUP_INSTRUCTIONS.md     # Additional setup notes
```

---

## 📞 Need Help?

- **Can't find what you're looking for?** Check the [FAQ](../FAQ.md)
- **Having issues?** See [Troubleshooting Guide](../TROUBLESHOOTING.md)
- **Still stuck?** Open a GitHub issue

---

**Happy building! 🚀**
