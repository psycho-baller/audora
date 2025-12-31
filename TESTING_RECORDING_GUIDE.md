# How to Record & Save a Conversation for Testing

## 🎯 Quick Guide

### Option 1: Record a Live Conversation (Best for Testing)

**Steps:**

1. **Start a new conversation:**
   - Go to `http://localhost:5173/dashboard`
   - Click "New Conversation" button
   - You'll be redirected to `/dashboard/conversations/:id`

2. **Start recording:**
   - Click the large **red "Record" button** (🔴)
   - Allow microphone permissions when prompted
   - You should see "Recording..." with a timer

3. **Speak or play audio:**
   - **Option A:** Just talk into your microphone for 30-60 seconds
   - **Option B:** Play a YouTube video or audio file in another tab
   - **Option C:** Have a friend join and have a real conversation
   
   **Good things to say for testing:**
   - Use filler words: "um", "uh", "like", "you know", "basically"
   - Use weak words: "thing", "stuff", "just", "really", "very"
   - Start sentences with: "And", "But", "So", "Well"
   - Speak for at least 1-2 minutes to get good analytics

4. **Stop recording:**
   - Click the **"Stop" button** (⏹️) when done
   - You'll see "Processing..." with a spinner

5. **Wait for processing:**
   - Takes 10-30 seconds depending on audio length
   - Speechmatics transcribes with speaker diarization
   - AI analyzes and extracts facts
   - Analytics are automatically generated

6. **Conversation is saved!**
   - Status automatically changes to "ended"
   - You'll see "Conversation Complete" at the top
   - Audio, transcript, and analytics are all saved

7. **Test the new features:**
   - Navigate to `/dashboard/view/:id` (or click "View Details" if available)
   - OR go back to `/dashboard` and click the conversation from history
   - You should see the new Yoodli-style interface!

---

### Option 2: Import Audio File (Fastest Way!)

If you have an existing audio file:

**Steps:**

1. **Go to Import page:**
   - Navigate to `http://localhost:5173/dashboard/import`

2. **Select audio file:**
   - Click "Choose File" 
   - Select an `.mp3`, `.wav`, `.m4a`, or `.webm` file
   - Good sources: 
     - Download from https://yoodli.ai/sample-speeches
     - Record yourself on phone and transfer
     - Use any existing audio file

3. **Choose conversation type:**
   - **"Solo practice"** - if it's one speaker
   - **"With someone"** - if it's a conversation with 2+ people

4. **Upload:**
   - Click "Upload & Process"
   - Wait for processing (20-60 seconds)
   - Longer audio = longer processing

5. **Redirect to conversation:**
   - You'll be automatically redirected to the conversation page
   - All features will be available immediately!

---

## 🎬 Sample Test Script

Use this script when recording to get ALL the highlight features:

```
"Um, so I wanted to talk about, like, the project we're working on.
I think it's really important that we, uh, you know, stay focused.
And another thing is, we should probably meet more often.
But I'm not sure if everyone has time for that.
So basically, the main thing is communication.
I just feel like we need to be on the same page.
There's a lot of things we need to cover.
Very excited about the progress so far though!"
```

This script includes:
- **Filler words:** um, uh, like, you know, basically
- **Weak words:** thing(s), just, really, very, probably
- **Sentence starters:** And, But, So
- **Clear pauses** for word timing

---

## ✅ What You Should See After Saving

Once conversation is saved and you view it at `/dashboard/view/:id`:

### Audio Player:
- ✅ Play/pause button works
- ✅ Timeline with colored markers (yellow/orange/blue dots)
- ✅ Waveform toggle button (🌊 icon)
- ✅ Skip buttons (⏮️ ⏭️)

### Transcript:
- ✅ Words highlight as audio plays
- ✅ Yellow = filler words
- ✅ Orange = weak words
- ✅ Blue = sentence starters
- ✅ Clicking words seeks audio

### Analytics Panel:
- ✅ Overview tab with AI feedback
- ✅ Word Choice tab with metrics
- ✅ Delivery tab with pacing gauge

---

## 🐛 Troubleshooting

### "Recording button doesn't work"
- Check microphone permissions in browser
- Look for error in console (F12)
- Try reloading the page

### "Processing takes forever"
- Speechmatics API might be slow
- Check Convex logs in terminal 2
- Make sure SPEECHMATICS_API_KEY is set

### "No word-level timing / markers not showing"
- This is the most common issue!
- **Cause:** Real-time recording uses Speechmatics which provides word timing
- **Fix:** If no markers show, try importing an audio file instead
- Check analytics are generated (Analytics panel)

### "Conversation stays in 'active' status"
- Recording didn't stop properly
- Manually end it:
  ```javascript
  // In browser console:
  await convex.mutation(
    api.conversations.updateStatus,
    { 
      conversationId: "YOUR_ID_HERE",
      status: "ended" 
    }
  );
  ```

### "No analytics showing"
- Analytics auto-generate when you view the conversation
- If not, check Convex logs
- Manually trigger:
  - Go to Analytics panel
  - Should auto-generate
  - Or refresh the page

---

## 📊 Check Data in Convex Dashboard

To verify everything saved correctly:

1. Go to https://dashboard.convex.dev
2. Select your project
3. Click "Data" tab
4. Check these tables:

**conversations:**
- ✅ Status = "ended"
- ✅ audioStorageId exists
- ✅ startedAt and endedAt timestamps
- ✅ summary field populated

**transcriptTurns:**
- ✅ Multiple entries for your conversation
- ✅ Each has userId, text, order
- ✅ **Most important:** `words` array with startTime, endTime, wordId

**speechAnalytics:**
- ✅ One entry per user per conversation
- ✅ fillerWords.count > 0
- ✅ pacing.wordsPerMinute exists
- ✅ scores.clarity/conciseness/confidence exist

---

## 🎯 Best Audio Files for Testing

Download these sample speeches from Yoodli:
- **Steve Jobs Stanford Speech:** Has natural pauses, good pacing
- **TED Talk samples:** Professional speakers with clear delivery
- **Podcast clips:** Conversational tone with filler words

Or create your own:
1. Record on phone using Voice Memos app
2. Speak for 2-3 minutes
3. Intentionally use filler words for testing
4. Transfer to computer and import

---

## 🚀 Quick Test Flow (5 minutes)

1. **Go to:** `/dashboard`
2. **Click:** "New Conversation"
3. **Click:** Record button 🔴
4. **Speak for:** 60 seconds (use sample script above)
5. **Click:** Stop button ⏹️
6. **Wait:** 20 seconds for processing
7. **Navigate to:** `/dashboard/view/:id` (or click from history)
8. **Test:** Play, click words, toggle waveform, generate AI feedback
9. **Done!** ✅

---

## 💡 Pro Tips

1. **Use Chrome:** Best compatibility for audio features
2. **Speak clearly:** Better transcription = better analytics
3. **Use filler words intentionally:** Makes testing highlights easier
4. **Import audio first:** Faster than live recording for testing
5. **Check console:** F12 → Console tab for any errors
6. **Use diagnostics:** Run `browser-diagnostics.js` in console

---

## 📞 Still Having Issues?

1. **Check browser console** for errors (F12)
2. **Check Convex logs** in terminal 2
3. **Check network tab** for failed API calls
4. **Share error messages** for help

The key is: **Just record something, stop it, wait for processing, and it will be saved automatically!**

No manual "save" button needed - the system handles everything! 🎉

