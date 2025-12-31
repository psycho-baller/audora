# Setup Guide - Yoodli-Style Speech Analysis

This guide will help you set up and deploy the new Yoodli-inspired features in your Audora application.

## Prerequisites

- Node.js 18+ installed
- pnpm package manager
- Convex account and project
- OpenAI API key
- Clerk authentication configured

## Environment Variables

Add the following to your environment variables:

```bash
# OpenAI API Key (required for AI feedback)
OPENAI_API_KEY=sk-...

# Convex (should already be configured)
CONVEX_DEPLOYMENT=...

# Clerk (should already be configured)
CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
```

## Installation Steps

### 1. Install Dependencies

```bash
# From project root
pnpm install
```

### 2. Database Migration

The new `personalizedFeedback` table needs to be added to your schema. This is already done in `packages/backend/convex/schema.ts`.

To apply the schema changes:

```bash
cd packages/backend
pnpm convex dev
```

Wait for Convex to sync the schema changes. You should see:

```
✓ Schema updated
```

### 3. Build Frontend

```bash
# From project root
cd apps/web
pnpm build
```

### 4. Test Locally

```bash
# Terminal 1: Start Convex
cd packages/backend
pnpm convex dev

# Terminal 2: Start web app
cd apps/web
pnpm dev
```

Visit `http://localhost:5173` (or your configured port) and navigate to a conversation detail page.

## Verification Checklist

### ✅ Audio Player
- [ ] Audio loads and plays correctly
- [ ] Timeline markers appear for metrics
- [ ] Skip buttons work (±10 seconds)
- [ ] Waveform toggle button appears
- [ ] Waveform generates and displays (may take a few seconds)
- [ ] Click-to-seek works on both timeline and waveform

### ✅ Transcript
- [ ] Transcript loads with proper speaker names
- [ ] Words are highlighted (yellow, orange, blue)
- [ ] Clicking a word seeks to that position
- [ ] Active word is highlighted during playback
- [ ] Auto-scroll follows playback
- [ ] "You" badge appears for current user

### ✅ Analytics
- [ ] Analytics auto-generate on first view
- [ ] Three tabs appear (Overview, Word Choice, Delivery)
- [ ] Overview tab shows AI feedback section
- [ ] "Generate AI Feedback" button appears
- [ ] Clicking generates feedback (check console for API calls)
- [ ] Feedback displays with proper formatting
- [ ] Other tabs show existing metrics

### ✅ Export & Share
- [ ] Share & Export button appears in header
- [ ] Dialog opens with options
- [ ] Copy link works
- [ ] Export transcript downloads .txt file
- [ ] Export full data downloads .json file
- [ ] Export analytics report downloads .txt file

### ✅ Mobile
- [ ] Page is responsive on mobile
- [ ] Header wraps properly
- [ ] Transcript is readable
- [ ] Audio controls are touch-friendly
- [ ] Analytics accessible via bottom sheet

## Troubleshooting

### Issue: AI Feedback Not Generating

**Symptoms:** Button clicks but nothing happens

**Solutions:**
1. Check OpenAI API key is set correctly
2. Check browser console for errors
3. Verify Convex functions are deployed
4. Check OpenAI API quota/billing

**Debug:**
```bash
# Check Convex logs
cd packages/backend
pnpm convex logs
```

### Issue: Waveform Not Appearing

**Symptoms:** Toggle button doesn't show waveform

**Solutions:**
1. Check audio URL is valid
2. Check browser console for CORS errors
3. Verify audio file is accessible
4. Try a different browser (Chrome recommended)

**Debug:**
```javascript
// In browser console
console.log(audioUrl); // Should show valid URL
```

### Issue: Speaker Names Not Showing

**Symptoms:** Shows "Unknown Speaker" instead of names

**Solutions:**
1. Check users table has name/email fields
2. Verify conversation has initiator/scanner IDs
3. Check getSpeakers query returns data

**Debug:**
```bash
# In Convex dashboard, run query manually
getSpeakers({ conversationId: "..." })
```

### Issue: Timeline Markers Missing

**Symptoms:** No colored markers on timeline

**Solutions:**
1. Verify analytics have been generated
2. Check that transcript has word-level timing
3. Ensure current user ID matches transcript user IDs

**Debug:**
```javascript
// In browser console
console.log(analytics); // Should show metrics
console.log(transcriptTurns); // Should have words array
```

## Performance Optimization

### Waveform Generation

Waveform generation can be slow for long audio files. Consider:

1. **Reduce sample count** in `Waveform.tsx`:
   ```typescript
   const samples = 100; // Instead of 200
   ```

2. **Cache waveform data** (future enhancement):
   - Store waveform data in database
   - Load from cache instead of regenerating

### AI Feedback Generation

AI feedback calls OpenAI API which has costs and latency:

1. **Rate limiting** (recommended):
   ```typescript
   // In analytics.ts
   const RATE_LIMIT = 5; // Max 5 generations per hour
   ```

2. **Caching** (already implemented):
   - Feedback is stored in database
   - Only regenerates on explicit user request

3. **Batch processing** (future):
   - Generate feedback for multiple conversations
   - Process during off-peak hours

## Monitoring

### Key Metrics to Track

1. **API Usage:**
   - OpenAI API calls per day
   - Average cost per feedback generation
   - Success/error rate

2. **Performance:**
   - Waveform generation time
   - Page load time
   - Time to first interaction

3. **User Engagement:**
   - % of users viewing analytics
   - % of users generating AI feedback
   - % of users exporting data

### Recommended Tools

- **Convex Dashboard:** Monitor function calls and errors
- **OpenAI Dashboard:** Track API usage and costs
- **Sentry/LogRocket:** Error tracking and session replay
- **Google Analytics:** User behavior tracking

## Deployment

### Production Checklist

- [ ] Environment variables set in production
- [ ] Database schema deployed to production
- [ ] OpenAI API key has sufficient quota
- [ ] CORS configured for audio files
- [ ] CDN configured for static assets
- [ ] Error monitoring enabled
- [ ] Analytics tracking enabled

### Deployment Commands

```bash
# Deploy Convex backend
cd packages/backend
pnpm convex deploy

# Build and deploy web app (example for Vercel)
cd apps/web
pnpm build
vercel --prod
```

### Post-Deployment Verification

1. Visit production URL
2. Navigate to a conversation
3. Verify all features work
4. Check error logs for issues
5. Monitor API usage

## Cost Estimation

### OpenAI API Costs

Based on GPT-4o-mini pricing:

- **Input:** $0.150 per 1M tokens
- **Output:** $0.600 per 1M tokens

**Estimated per feedback generation:**
- Input: ~500 tokens = $0.000075
- Output: ~300 tokens = $0.00018
- **Total: ~$0.000255 per generation**

**Monthly costs (example):**
- 1,000 users
- 10 conversations per user per month
- 50% generate AI feedback
- **Total: 5,000 generations × $0.000255 = $1.28/month**

### Storage Costs

Convex storage is included in plan. Estimate:

- Feedback: ~1KB per entry
- 5,000 entries/month = 5MB
- **Negligible cost**

## Support

### Getting Help

1. **Check documentation:**
   - `YOODLI_IMPLEMENTATION.md` - Technical details
   - `PROJECT_SUMMARY.md` - Feature overview
   - This file - Setup and troubleshooting

2. **Check logs:**
   - Browser console
   - Convex logs
   - Server logs

3. **Common issues:**
   - See Troubleshooting section above

### Contact

For additional support:
- GitHub Issues: [Your repo URL]
- Email: [Your support email]
- Discord: [Your Discord server]

## Next Steps

After successful setup:

1. **Test with real data:**
   - Upload sample conversations
   - Generate analytics
   - Test AI feedback

2. **Gather user feedback:**
   - Beta test with small group
   - Collect feedback on UX
   - Iterate on design

3. **Monitor performance:**
   - Track key metrics
   - Optimize bottlenecks
   - Scale infrastructure

4. **Plan enhancements:**
   - Review future features list
   - Prioritize based on feedback
   - Create implementation roadmap

## Congratulations! 🎉

You've successfully set up the Yoodli-style speech analysis platform. Your users can now benefit from:

- Professional audio player with waveform
- Interactive transcript with highlights
- AI-powered personalized feedback
- Comprehensive analytics dashboard
- Easy export and sharing

Happy coding! 🚀

