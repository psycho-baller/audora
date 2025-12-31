# Quick Reference - Yoodli Implementation

## 📁 File Structure

```
audora/
├── apps/web/app/
│   ├── components/
│   │   ├── transcript/
│   │   │   └── TranscriptPlayer.tsx          ⭐ Main player component
│   │   ├── analytics/
│   │   │   └── PersonalizedFeedback.tsx      ⭐ AI feedback UI
│   │   ├── audio/
│   │   │   └── Waveform.tsx                  ⭐ Waveform visualization
│   │   ├── export/
│   │   │   └── ExportDialog.tsx              ⭐ Export modal
│   │   └── dashboard/
│   │       └── analytics-panel.tsx           ⭐ Analytics tabs
│   └── routes/
│       └── dashboard/
│           └── view.$id.tsx                  ⭐ Main conversation page
│
├── packages/backend/convex/
│   ├── analytics.ts                          ⭐ Analytics & AI endpoints
│   ├── conversations.ts                      ⭐ Conversation queries
│   └── schema.ts                             ⭐ Database schema
│
└── docs/
    ├── YOODLI_IMPLEMENTATION.md              📖 Technical details
    ├── PROJECT_SUMMARY.md                    📖 Feature overview
    ├── SETUP_GUIDE.md                        📖 Setup instructions
    └── QUICK_REFERENCE.md                    📖 This file
```

## 🎨 Key Components

### TranscriptPlayer
**Path:** `apps/web/app/components/transcript/TranscriptPlayer.tsx`

**Props:**
```typescript
{
  conversationId: Id<"conversations">;
  getUserName: (userId?: Id<"users">) => string;
}
```

**Features:**
- Audio playback with controls
- Timeline with metric markers
- Waveform visualization (toggle)
- Interactive transcript
- Word-level highlighting
- Click-to-seek

### PersonalizedFeedback
**Path:** `apps/web/app/components/analytics/PersonalizedFeedback.tsx`

**Props:**
```typescript
{
  conversationId: Id<"conversations">;
  userId: Id<"users">;
}
```

**Features:**
- AI-generated feedback
- Categorized insights
- One-click generation
- Persistent storage

### Waveform
**Path:** `apps/web/app/components/audio/Waveform.tsx`

**Props:**
```typescript
{
  audioUrl: string;
  currentTime: number;
  duration: number;
  onSeek?: (time: number) => void;
  className?: string;
}
```

**Features:**
- Real-time generation
- Click-to-seek
- Color-coded playback
- Overlay markers

### ExportDialog
**Path:** `apps/web/app/components/export/ExportDialog.tsx`

**Props:**
```typescript
{
  conversationId: Id<"conversations">;
  trigger?: React.ReactNode;
}
```

**Features:**
- Share link
- Export transcript (.txt)
- Export full data (.json)
- Export analytics report (.txt)

## 🔌 API Endpoints

### Analytics

```typescript
// Get personalized feedback
getPersonalizedFeedback(args: {
  conversationId: Id<"conversations">;
  userId: Id<"users">;
}): PersonalizedFeedback | null

// Generate AI feedback
generatePersonalizedFeedback(args: {
  conversationId: Id<"conversations">;
  userId: Id<"users">;
}): Promise<Feedback>

// Create feedback
createPersonalizedFeedback(args: {
  conversationId: Id<"conversations">;
  userId: Id<"users">;
  summary: string;
  strengths: string[];
  improvements: string[];
  actionItems: string[];
  comparisonToPrevious?: string;
  generatedAt: number;
}): Id<"personalizedFeedback">

// Update feedback
updatePersonalizedFeedback(args: {
  feedbackId: Id<"personalizedFeedback">;
  // ... same fields as create
}): void
```

### Conversations

```typescript
// Get speaker information
getSpeakers(args: {
  conversationId: Id<"conversations">;
}): Record<string, {
  name: string;
  email?: string;
  image?: string;
}> | null
```

## 🎨 Color System

```typescript
// Metric colors
const COLORS = {
  filler: "yellow-500",      // Filler words
  weak: "orange-500",        // Weak words
  starter: "blue-500",       // Sentence starters
  primary: "primary",        // Current user
  secondary: "blue-600",     // Other speakers
  success: "green-500",      // Strengths
  warning: "orange-500",     // Improvements
  info: "blue-500",          // Actions
  accent: "purple-500",      // Progress
};
```

## 🔧 Configuration

### Waveform Settings
**File:** `apps/web/app/components/audio/Waveform.tsx`

```typescript
const samples = 200;        // Number of bars (adjust for performance)
const blockSize = Math.floor(rawData.length / samples);
```

### AI Feedback Prompt
**File:** `packages/backend/convex/analytics.ts`

```typescript
const prompt = `You are an expert communication coach...`;
// Customize prompt for different feedback styles
```

### Timeline Markers
**File:** `apps/web/app/components/transcript/TranscriptPlayer.tsx`

```typescript
const timelineMarkers = useMemo(() => {
  // Customize which metrics appear on timeline
  const markers = [];
  // ... add markers
  return markers;
}, [allWords, wordHighlights]);
```

## 🚀 Common Tasks

### Add New Metric Type

1. **Update schema** (`schema.ts`):
```typescript
// Add to speechAnalytics
newMetric: v.object({
  count: v.number(),
  // ... other fields
})
```

2. **Update analytics** (`analytics.ts`):
```typescript
// Add calculation logic
const newMetricData = calculateNewMetric(transcript);
```

3. **Update UI** (`TranscriptPlayer.tsx`):
```typescript
// Add highlight type
type HighlightType = "filler" | "weak" | "starter" | "new";

// Add color
case "new":
  highlightClasses = "bg-purple-500/20...";
```

### Customize AI Feedback

**File:** `packages/backend/convex/analytics.ts`

```typescript
const prompt = `
You are a [customize role] analyzing [customize context].

Based on the following metrics:
[customize metrics]

Provide feedback in the following format:
[customize format]

Make the feedback:
[customize guidelines]
`;
```

### Add Export Format

**File:** `apps/web/app/components/export/ExportDialog.tsx`

```typescript
const handleExportNewFormat = () => {
  // 1. Prepare data
  const data = prepareData();
  
  // 2. Format content
  const content = formatContent(data);
  
  // 3. Create blob
  const blob = new Blob([content], { type: "..." });
  
  // 4. Download
  downloadBlob(blob, "filename.ext");
};
```

## 🐛 Debug Commands

### Check Analytics
```typescript
// Browser console
const analytics = await convex.query(
  api.analytics.getAnalytics,
  { conversationId: "...", userId: "..." }
);
console.log(analytics);
```

### Check Speakers
```typescript
// Browser console
const speakers = await convex.query(
  api.conversations.getSpeakers,
  { conversationId: "..." }
);
console.log(speakers);
```

### Check Feedback
```typescript
// Browser console
const feedback = await convex.query(
  api.analytics.getPersonalizedFeedback,
  { conversationId: "...", userId: "..." }
);
console.log(feedback);
```

### Convex Logs
```bash
cd packages/backend
pnpm convex logs --tail
```

## 📊 Performance Tips

### Optimize Waveform
```typescript
// Reduce samples for faster generation
const samples = 100; // Instead of 200

// Skip waveform for long audio
if (duration > 3600) {
  setShowWaveform(false);
}
```

### Optimize Timeline Markers
```typescript
// Limit number of markers
const maxMarkers = 100;
const markers = allMarkers.slice(0, maxMarkers);
```

### Optimize AI Calls
```typescript
// Cache feedback in component state
const [cachedFeedback, setCachedFeedback] = useState(null);

// Only generate if not cached
if (!cachedFeedback) {
  const feedback = await generateFeedback();
  setCachedFeedback(feedback);
}
```

## 🎯 Testing Checklist

```bash
# Quick test script
□ Load conversation page
□ Play audio
□ Click word in transcript (should seek)
□ Toggle waveform
□ Click waveform (should seek)
□ Open analytics
□ Generate AI feedback
□ Export transcript
□ Export JSON
□ Export report
□ Test on mobile
```

## 📞 Quick Help

### Issue: Waveform not showing
```typescript
// Check audio URL
console.log(audioUrl); // Should be valid URL

// Check browser support
console.log(window.AudioContext); // Should be defined
```

### Issue: AI feedback not generating
```bash
# Check OpenAI key
echo $OPENAI_API_KEY

# Check Convex logs
pnpm convex logs | grep "GENERATE PERSONALIZED"
```

### Issue: Markers not appearing
```typescript
// Check analytics
console.log(analytics?.fillerWords?.count); // Should be > 0

// Check word highlights
console.log(wordHighlights.size); // Should be > 0
```

## 🔗 Useful Links

- **Convex Docs:** https://docs.convex.dev
- **OpenAI API:** https://platform.openai.com/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Lucide Icons:** https://lucide.dev
- **React Router:** https://reactrouter.com

## 💡 Pro Tips

1. **Use React DevTools** to inspect component state
2. **Use Convex Dashboard** to test queries directly
3. **Use Network tab** to debug API calls
4. **Use Console** to log data at each step
5. **Use Git blame** to understand code history

---

**Need more help?** Check the full documentation:
- `YOODLI_IMPLEMENTATION.md` - Technical details
- `PROJECT_SUMMARY.md` - Feature overview
- `SETUP_GUIDE.md` - Setup instructions

