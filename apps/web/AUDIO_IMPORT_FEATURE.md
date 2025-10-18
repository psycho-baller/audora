# Audio Import Feature

## Overview
Import your own audio files and connect them to friends in your network. The system will automatically transcribe the audio, extract facts, and add it to your conversation history.

## How to Import an Audio File

### Step 1: Access the Import Page

**From Dashboard:**
1. Navigate to `/dashboard`
2. Click the **"Import Audio"** button in the header
3. You'll be taken to `/dashboard/import`

### Step 2: Select Your Audio File

**Supported Formats:**
- MP3 (audio/mpeg, audio/mp3)
- WAV (audio/wav)
- M4A (audio/m4a)
- MP4 Audio (audio/mp4)
- WebM (audio/webm)

**File Size Limit:** 100MB maximum

**How to Select:**
1. Click the file input or drag & drop
2. Choose your audio file
3. See confirmation: "Selected: filename.mp3 (5.23 MB)"

### Step 3: Select a Friend

**Requirements:**
- You must have at least one contact in your network
- The friend must have been in previous conversations with you

**How to Select:**
1. Browse your list of contacts
2. Click on the person who was in this conversation
3. See checkmark confirmation

**No Contacts Yet?**
- Click "View Network" to see instructions
- Have a conversation first to build your network
- Then return to import historical conversations

### Step 4: Import

1. Click **"Import Conversation"** button
2. Wait for the process to complete (may take 2-5 minutes)
3. Automatically redirected to the conversation page

## Import Process Steps

### Behind the Scenes

1. **Create Conversation** (15%)
   - Creates a new conversation entry
   - Sets location as "Imported Conversation"
   - You are set as the initiator

2. **Link to Friend** (20%)
   - Connects the conversation to your selected friend
   - Friend is set as the "scanner" (second participant)
   - Conversation status set to "active"

3. **Prepare Upload** (30%)
   - Generates secure upload URL
   - Prepares Convex storage

4. **Upload Audio** (60%)
   - Uploads your audio file to Convex storage
   - File is securely stored
   - Storage ID linked to conversation

5. **Save Storage ID** (70%)
   - Links the uploaded file to conversation
   - Enables future playback

6. **Transcribe & Process** (100%)
   - Uses OpenAI Whisper for transcription
   - Identifies speakers (you and your friend)
   - Extracts facts about both speakers
   - Generates conversation summary
   - Saves all data to database

## What Happens After Import

### Conversation Page
You'll be redirected to the conversation detail page showing:

**Transcript:**
- Turn-by-turn conversation
- Speaker identification
- Full text of what was said

**Facts Extracted:**
- Key information about you
- Key information about your friend
- Automatically added to knowledge base

**Analytics (if enabled):**
- Speech patterns
- Communication metrics
- Conversation insights

**Actions Available:**
- Download transcript
- Call friend to reflect on conversation
- View conversation summary

### Network Updates
The conversation is automatically added to:
- Your conversation history
- Your friend's network entry
- Shared facts between you and friend

## Technical Details

### Backend Functions Used

**Mutations:**
- `api.conversations.create` - Creates conversation
- `api.conversations.linkConversationToFriend` - Links to friend
- `api.conversations.generateUploadUrl` - Gets upload URL
- `api.conversations.saveAudioStorageId` - Links storage ID

**Actions:**
- `api.transcription.transcribeAudio` - Processes audio file

### File Storage
- Files stored in Convex storage (`_storage`)
- Storage ID saved as `audioStorageId` in conversations table
- Files are never publicly accessible
- Only accessible by conversation participants

### Transcription Process
1. Audio file converted to buffer
2. Sent to OpenAI Whisper API
3. Returns timestamped transcript
4. AI processes transcript to:
   - Identify speakers
   - Extract facts
   - Generate summary
5. Data saved to database

## Use Cases

### 1. Historical Conversations
Import recordings of past conversations to:
- Build comprehensive conversation history
- Extract insights from old recordings
- Connect past interactions with current contacts

### 2. External Recordings
Import audio from:
- Voice memos app
- Other recording devices
- Professional recording equipment
- Phone call recordings

### 3. Offline Conversations
Record conversations offline, then:
- Upload when you have internet
- Process and analyze later
- Add to your conversation database

### 4. Batch Processing
Import multiple conversations:
- Upload one at a time
- Build complete history with a contact
- Analyze communication patterns over time

## Limitations

### Current Limitations
1. **Two-person conversations only**
   - System designed for 1-on-1 conversations
   - Group conversations not yet supported

2. **Friend must be in network**
   - Can only link to existing contacts
   - Must have had at least one previous conversation

3. **Single file per import**
   - Upload one file at a time
   - No batch upload yet

4. **100MB file size limit**
   - Large files need compression first
   - Typical 1-hour conversation: ~50MB

5. **No speaker pre-identification**
   - AI guesses who is who
   - May not always be accurate
   - Manual correction not yet available

### Workarounds

**For group conversations:**
- Extract 1-on-1 segments
- Import each segment separately

**For large files:**
- Compress audio before upload
- Use lower bitrate (64kbps is usually fine for voice)
- Split into multiple files if needed

**For new contacts:**
- Have a quick conversation first
- Then import historical recordings

## Error Handling

### Common Errors

**"Please select an audio file"**
- File type not recognized
- Try converting to MP3 or WAV

**"File size must be less than 100MB"**
- File too large
- Compress or split the file

**"Please select a friend"**
- No friend selected
- Click on a contact before importing

**"Friend not found"**
- Selected friend not in database
- Try refreshing the page

**"Failed to upload file"**
- Network issue
- Try again with stable connection

**"Transcription failed"**
- Audio quality too poor
- File corrupted
- Try re-exporting the file

### Recovery

If import fails:
1. Check error message
2. Fix the issue
3. Try again with same file
4. File is not stored if process fails

## Privacy & Security

### Your Data
- Audio files stored securely in Convex
- Only accessible by conversation participants
- Not shared with third parties (except OpenAI for transcription)
- Can be deleted by deleting conversation

### Friend's Data
- Friend doesn't need to approve import
- Friend's facts extracted automatically
- Friend can see conversation if they log in
- Friend can access same transcript

### OpenAI Processing
- Audio sent to OpenAI Whisper for transcription
- Processed according to OpenAI's privacy policy
- Not used for training by default
- Transcription is temporary, stored result in your database

## Future Enhancements

### Planned Features
1. **Batch import** - Upload multiple files at once
2. **Speaker identification** - Pre-select who is who
3. **Manual fact editing** - Correct extracted facts
4. **Group conversations** - Support 3+ participants
5. **Progress resumption** - Resume failed uploads
6. **Audio playback** - Listen to recordings in-app
7. **Timestamp linking** - Link facts to specific moments
8. **Export options** - Download with facts and summary

### Requested Features
- WhatsApp audio import
- Zoom recording import
- Calendar integration (auto-link by date)
- Voice-to-text real-time preview
- Speaker diarization training

## Troubleshooting

### Import is Slow
**Normal:** 1-2 minutes per 10 minutes of audio
**Factors:**
- File size
- Audio quality
- Server load
- Network speed

### Transcription Inaccurate
**Causes:**
- Background noise
- Multiple speakers talking simultaneously
- Poor audio quality
- Strong accents

**Solutions:**
- Use noise cancellation before export
- Re-record with better mic
- Manually edit transcript (coming soon)

### Friend Not Appearing
**Check:**
1. Refresh the page
2. Verify you've had a conversation with them
3. Check they're in your network at `/dashboard/network`
4. Try creating a quick conversation first

## Example Workflow

### Scenario: Import a podcast recording

1. **Prepare Audio**
   ```
   - Export podcast as MP3
   - Ensure it's under 100MB
   - Verify it's a 1-on-1 conversation
   ```

2. **Navigate to Import**
   ```
   Dashboard → Import Audio button
   ```

3. **Upload**
   ```
   - Select your MP3 file
   - Choose your podcast guest from contacts
   - Click "Import Conversation"
   ```

4. **Wait for Processing**
   ```
   - Uploading: 30 seconds
   - Transcribing: 2-3 minutes
   - Processing: 1 minute
   - Total: ~4 minutes for 30min podcast
   ```

5. **Review Results**
   ```
   - Read transcript
   - Check extracted facts
   - Download summary
   - Share with guest (optional)
   ```

## Summary

The audio import feature allows you to:
✅ Upload existing audio recordings
✅ Connect them to friends in your network
✅ Automatically transcribe and process
✅ Extract facts and insights
✅ Build comprehensive conversation history

**Access:** Dashboard → "Import Audio" button
**Time:** 2-5 minutes per conversation
**Limit:** 100MB per file
**Format:** MP3, WAV, M4A, WebM
