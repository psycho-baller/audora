# Testing Checklist - Yoodli-Style Features

## ✅ Pre-Testing Setup

- [x] Convex dev running (terminal 2) ✓
- [x] Web app running (terminal 3) ✓
- [x] OpenAI API key configured ✓
- [ ] Have at least one conversation with audio uploaded
- [ ] Have at least one conversation with transcript and analytics generated

## 🎯 Test Scenario

**Best way to test:** Use an existing conversation that has:
1. Audio file uploaded
2. Transcript with word-level timing
3. Analytics already generated (or will auto-generate)

## 📋 Feature Testing

### 1. Navigation & Page Load

**Steps:**
1. Navigate to `http://localhost:5173/dashboard` (or your port)
2. Click on any completed conversation
3. Should redirect to `/dashboard/view/:id`

**Expected:**
- ✅ Page loads without errors
- ✅ Header shows conversation title and metadata
- ✅ Audio player appears at top
- ✅ Transcript appears below audio player
- ✅ Analytics panel appears on right (desktop) or accessible via button (mobile)

**Check browser console for errors:** Press F12 → Console tab

---

### 2. Audio Player - Basic Playback

**Steps:**
1. Click the large play button (▶️)
2. Audio should start playing
3. Click pause button (⏸️)
4. Audio should stop

**Expected:**
- ✅ Play button turns into pause button
- ✅ Audio plays from the beginning
- ✅ Time counter updates (e.g., 0:05 / 3:45)
- ✅ Progress bar fills as audio plays
- ✅ Pause stops playback

**Debug if not working:**
```javascript
// In browser console (F12)
console.log(audioUrl); // Should show a valid URL
console.log(duration); // Should show duration in seconds
```

---

### 3. Timeline Markers (KEY FEATURE!)

**Steps:**
1. Look at the progress bar area
2. You should see small colored dots/lines above the progress bar
3. Hover over the markers

**Expected:**
- ✅ Yellow markers = Filler words
- ✅ Orange markers = Weak words  
- ✅ Blue markers = Sentence starters
- ✅ Markers appear at the correct positions
- ✅ Tooltip shows word and type when hovering

**Legend should be visible:**
- At bottom of audio player card
- Shows: "Timeline markers: [yellow dot] Filler words [orange dot] Weak words [blue dot] Sentence starters"

**If no markers appear:**
```javascript
// In browser console
console.log(analytics); // Should show object with fillerWords, weakWords, etc.
console.log(analytics?.fillerWords?.count); // Should be > 0
```

---

### 4. Waveform Visualization

**Steps:**
1. Look for a wave icon (🌊) button next to the time display
2. Click the wave icon
3. Wait a few seconds for waveform to generate

**Expected:**
- ✅ Button shows loading animation with fake waveform bars
- ✅ Real waveform appears (200 vertical bars)
- ✅ Bars are colored: primary color for played, gray for unplayed
- ✅ Timeline markers still visible on top of waveform
- ✅ Wave icon turns primary color when active

**Click on waveform:**
- ✅ Audio should seek to that position
- ✅ Playback should start from new position

**Toggle back:**
- Click wave icon again
- ✅ Returns to simple timeline view

---

### 5. Transcript - Word Highlighting (CRITICAL!)

**Steps:**
1. Scroll down to the transcript section
2. Start playing audio
3. Watch the words as audio plays

**Expected:**
- ✅ Current word is highlighted with primary color background
- ✅ Highlighted word scrolls into view automatically
- ✅ Filler words have yellow background + border
- ✅ Weak words have orange background + border
- ✅ Sentence starters have blue background + border
- ✅ Non-highlighted words are normal text

**Word types to look for:**
- **Yellow:** "um", "uh", "like", "you know", "basically", etc.
- **Orange:** "thing", "stuff", "just", "really", "very", etc.
- **Blue:** First word of sentences starting with "and", "but", "so", etc.

**Hover effects:**
- ✅ Words should have subtle hover effect
- ✅ Cursor changes to pointer on hover

---

### 6. Click-to-Seek (SUPER IMPORTANT!)

**Steps:**
1. Click on any word in the transcript
2. Audio should jump to that word's timestamp

**Expected:**
- ✅ Audio seeks to clicked word
- ✅ That word becomes highlighted
- ✅ Audio starts playing from that position
- ✅ Works on any word (highlighted or not)

**Try clicking:**
- A filler word (yellow)
- A weak word (orange)
- A regular word
- A word near the end of conversation

---

### 7. Skip Controls

**Steps:**
1. Click the "Skip Back" button (⏮️)
2. Audio should go back 10 seconds
3. Click the "Skip Forward" button (⏭️)
4. Audio should go forward 10 seconds

**Expected:**
- ✅ Skip back: current time decreases by 10s
- ✅ Skip forward: current time increases by 10s
- ✅ Can't skip before 0:00
- ✅ Can't skip past end of audio

---

### 8. Speaker Identification

**Steps:**
1. Look at the transcript
2. Each turn should have an avatar and name

**Expected:**
- ✅ Different speakers have different colored avatars
- ✅ Current user's avatar is primary gradient (purple/pink)
- ✅ Other speakers have blue-purple gradient
- ✅ Current user's turns have "You" badge
- ✅ Speaker names show (not just "Speaker 1", "Speaker 2")

**Check names:**
```javascript
// In browser console
const speakers = await convex.query(
  api.conversations.getSpeakers,
  { conversationId: "YOUR_CONVERSATION_ID" }
);
console.log(speakers);
```

---

### 9. Analytics Panel - Overview Tab

**Steps:**
1. Click on "Analytics" in the right sidebar (desktop) or bottom button (mobile)
2. Click "Overview" tab
3. Look for "AI Personalized Feedback" section

**Expected:**
- ✅ "AI Personalized Feedback" card appears
- ✅ "Generate AI Feedback" button is visible
- ✅ Click button → Shows "Generating..." with loading spinner
- ✅ After ~2-5 seconds, feedback appears with:
  - Summary paragraph
  - Strengths section (green)
  - Areas to Improve section (orange)
  - Action Items section (blue)

**If feedback doesn't generate:**
```bash
# Check Convex logs in terminal 2
# Should see: "=== GENERATE PERSONALIZED FEEDBACK ==="
# Should see OpenAI API call
# Check for errors
```

---

### 10. Analytics Panel - Word Choice Tab

**Steps:**
1. Click "Word Choice" tab
2. Expand each section

**Expected:**
- ✅ Repetition section shows repeated words
- ✅ Filler Words section shows count and rate per minute
- ✅ Weak Words section shows examples (if any)
- ✅ Conciseness section shows score
- ✅ Sentence Starters section shows weak starters (if any)

---

### 11. Analytics Panel - Delivery Tab

**Steps:**
1. Click "Delivery" tab
2. Look at Pacing section

**Expected:**
- ✅ Pacing gauge shows WPM (words per minute)
- ✅ Gauge needle points to correct position
- ✅ Labels: "Slow", "Conversational", "Fast"
- ✅ Pacing Variation chart shows graph
- ✅ Can hover over graph to see WPM at different times

---

### 12. Export & Share

**Steps:**
1. Click "Share & Export" button in header
2. Dialog opens with options

**Test each option:**

**a) Copy Link:**
- ✅ Click "Copy Link"
- ✅ Shows "Copied!" confirmation
- ✅ Paste in new tab → loads same conversation

**b) Export Transcript:**
- ✅ Click "Export Transcript (.txt)"
- ✅ File downloads immediately
- ✅ Open file → shows clean transcript with speaker names

**c) Export Full Data:**
- ✅ Click "Export Full Data (.json)"
- ✅ File downloads
- ✅ Open file → valid JSON with all data

**d) Export Analytics Report:**
- ✅ Click "Export Analytics Report (.txt)"
- ✅ File downloads
- ✅ Open file → shows formatted analytics summary

---

### 13. Mobile Responsiveness

**Steps:**
1. Resize browser window to mobile size (< 768px)
2. Or open DevTools (F12) → Toggle device toolbar (Ctrl+Shift+M)
3. Select "iPhone 12 Pro" or similar

**Expected:**
- ✅ Header stacks vertically
- ✅ Metadata wraps properly
- ✅ "Share & Export" button shows "Share" only
- ✅ Transcript is readable with proper spacing
- ✅ Audio controls are touch-friendly
- ✅ Analytics panel hidden, accessible via bottom button
- ✅ Clicking button shows analytics in modal
- ✅ Modal has close button and swipes up smoothly

---

## 🐛 Common Issues & Fixes

### Issue: No Timeline Markers

**Cause:** Analytics not generated or no metrics found

**Fix:**
1. Check if analytics exist
2. Manually trigger analytics generation:
   - Go to analytics panel
   - Should auto-generate on first view
3. Check transcript has word-level timing data

### Issue: Waveform Not Generating

**Cause:** Audio URL inaccessible or CORS issue

**Fix:**
1. Check audio URL in console
2. Try a different browser (Chrome recommended)
3. Check network tab for CORS errors

### Issue: Click-to-Seek Not Working

**Cause:** Words don't have timing data

**Fix:**
1. Check transcript has `words` array
2. Each word should have `startTime`, `endTime`, `wordId`
3. Re-upload audio if needed

### Issue: AI Feedback Not Generating

**Cause:** OpenAI API key issue or quota exceeded

**Fix:**
1. Check API key is set: `npx convex env get OPENAI_API_KEY`
2. Check OpenAI dashboard for quota/billing
3. Check Convex logs for error messages

---

## ✨ Success Criteria

Your implementation is working correctly if:

- ✅ Audio plays and syncs with transcript
- ✅ Timeline markers show in correct positions
- ✅ Words highlight as audio plays
- ✅ Clicking words seeks audio
- ✅ Filler/weak/starter words are visually distinct
- ✅ Waveform generates and is interactive
- ✅ AI feedback generates successfully
- ✅ All export formats work
- ✅ Mobile layout is usable

---

## 📊 Test Data Quality

For best testing results, use a conversation with:
- ✅ At least 2-3 minutes of audio
- ✅ Clear speech with some filler words
- ✅ Multiple speakers
- ✅ Word-level timing data in transcript
- ✅ Analytics already generated

---

## 🎥 Video Walkthrough (Recommended)

1. Record your screen while testing
2. Go through each feature systematically
3. Note any issues or unexpected behavior
4. Share recording for feedback

---

## 📞 Need Help?

If something isn't working:

1. **Check browser console** (F12) for errors
2. **Check Convex logs** in terminal 2
3. **Check network tab** for failed requests
4. **Take screenshots** of the issue
5. **Share error messages** for debugging

---

**Ready to test?** Start from the top and work your way down! 🚀

