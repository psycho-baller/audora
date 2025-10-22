# 📚 Audora Documentation Index

Welcome to the Audora documentation! This index will help you find the right guide for your needs.

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

- **[Architecture Overview](../ARCHITECTURE.md)** - Deep dive into the tech stack
  - High-level architecture
  - Monorepo structure
  - Technology explanations
  - Data flow examples
  - Key concepts

- **[Main README](../README.md)** - Project overview and features
  - What Audora does
  - Feature list
  - Use cases

### Setup & Configuration

- **[Setup Instructions](./SETUP_INSTRUCTIONS.md)** - Detailed configuration guide
  - API keys setup
  - Environment variables
  - Authentication configuration
  - Production deployment

---

## 🔧 Feature Documentation

### Core Features

- **[Audio Import Flow](./AUDIO_IMPORT_FEATURE.md)** - Import audio files from other apps
  - Architecture and flow
  - API functions
  - Error handling
  - Testing guide

- **[Audio Chunking](./AUDIO_CHUNKING_FEATURE.md)** - Process large audio files
  - Chunking strategy
  - Implementation details
  - Performance considerations

### Transcription & Analysis

- **[Speechmatics Integration](./SPEECHMATICS_INTEGRATION.md)** - Real-time transcription
  - Setup guide
  - API usage
  - Best practices

- **[Speaker Diarization](./SPEAKER_DIARIZATION.md)** - Identify who said what
  - How it works
  - Configuration
  - Troubleshooting

- **[Batch Transcription](./BATCH_TRANSCRIBE_UPDATE.md)** - Process pre-recorded audio
  - Batch processing flow
  - API reference
  - Error handling

### Advanced Features

- **[VAPI Calling Setup](./VAPI_CALLING_SETUP.md)** - Voice AI phone calls
  - Setup instructions
  - Integration guide
  - Use cases

- **[Relationship Analytics](./FEATURE_RELATIONSHIP_ANALYTICS.md)** - Track connections
  - Knowledge graph
  - Relationship insights
  - Data visualization

- **[Conversation Call Feature](./CONVERSATION_CALL_FEATURE.md)** - AI conversation reflection
  - How it works
  - Implementation
  - Best practices

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
- **Key Files**:
  - `app/routes/` - Page routes
  - `app/components/` - UI components
  - `.env.local` - Environment variables

### Mobile App

- **Location**: `apps/expo/`
- **Framework**: React Native + Expo
- **Quick Start**: [QUICK_START_MOBILE.md](./QUICK_START_MOBILE.md)
- **Key Files**:
  - `app/(tabs)/` - Tab screens
  - `app/(auth)/` - Auth screens
  - `components/` - UI components
  - `.env.local` - Environment variables

### Backend

- **Location**: `packages/backend/`
- **Platform**: Convex
- **Key Files**:
  - `convex/schema.ts` - Database schema
  - `convex/conversations.ts` - Conversation functions
  - `convex/transcription.ts` - AI processing
  - `convex/analytics.ts` - Speech analytics

---

## 🎓 Learning Resources

### For Beginners

1. Start with [Getting Started Guide](../GETTING_STARTED.md)
2. Read [Architecture Overview](../ARCHITECTURE.md)
3. Follow a [Quick Start Guide](./QUICK_START_WEB.md)
4. Explore the codebase
5. Try making small changes

### For Contributors

1. Read [Development Guide](./DEVELOPMENT.md)
2. Check [Architecture Overview](../ARCHITECTURE.md)
3. Review feature documentation
4. Look at existing code
5. Start with small improvements

### External Resources

- **Convex**: <https://docs.convex.dev/>
- **React**: <https://react.dev/>
- **React Native**: <https://reactnative.dev/>
- **Expo**: <https://docs.expo.dev/>
- **React Router**: <https://reactrouter.com/>
- **TypeScript**: <https://www.typescriptlang.org/>

---

## 🗺️ Documentation Map

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
    │
    ├── Quick Start Guides
    ├── QUICK_START_WEB.md       # Web app quick start
    ├── QUICK_START_MOBILE.md    # Mobile app quick start
    │
    ├── Setup & Configuration
    ├── SETUP.md                  # Detailed setup guide
    ├── SETUP_INSTRUCTIONS.md     # Additional setup notes
    ├── DEVELOPMENT.md            # Development workflows
    │
    └── Feature Documentation
        ├── AUDIO_IMPORT_FEATURE.md
        ├── AUDIO_CHUNKING_FEATURE.md
        ├── SPEECHMATICS_INTEGRATION.md
        ├── SPEAKER_DIARIZATION.md
        ├── BATCH_TRANSCRIBE_UPDATE.md
        ├── VAPI_CALLING_SETUP.md
        ├── FEATURE_RELATIONSHIP_ANALYTICS.md
        └── CONVERSATION_CALL_FEATURE.md
```

---

## 🤝 Contributing to Documentation

Found an error or want to improve the docs?

1. Edit the relevant markdown file
2. Submit a pull request
3. Help make Audora more accessible!

---

## 📞 Need Help?

- **Can't find what you're looking for?** Check the [FAQ](../FAQ.md)
- **Having issues?** See [Troubleshooting Guide](../TROUBLESHOOTING.md)
- **Still stuck?** Open a GitHub issue
- **Want to chat?** Join the [Convex Discord](https://convex.dev/community)

---

**Happy building! 🚀**
