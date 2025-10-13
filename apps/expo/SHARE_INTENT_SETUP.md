# Share Intent Setup for Audora

This document explains how audio file sharing into the app is configured.

## Configuration

### 1. Package Installation
- `expo-share-intent` - Main package for handling share intents
- `expo-linking` - Required for deep linking
- `patch-package` - Required for xcode patching

### 2. App Configuration (`app.json`)

The app is configured to accept:
- **iOS**: Audio/video files (up to 10), text, and web URLs
- **Android**: Audio files (`audio/*`), video files (`video/*`), and text

```json
{
  "iosActivationRules": {
    "NSExtensionActivationSupportsFileWithMaxCount": 10,
    "NSExtensionActivationSupportsText": true,
    "NSExtensionActivationSupportsWebURLWithMaxCount": 1
  },
  "androidIntentFilters": ["audio/*", "video/*", "text/*"]
}
```

### 3. URL Scheme
The app uses the custom URL scheme: `audora://`

## How It Works

### Flow
1. User shares an audio file from another app (Files, Voice Memos, etc.)
2. "Audora" appears in the share sheet
3. User selects Audora
4. App opens and automatically navigates to `/(tabs)/import`
5. The import screen processes the audio file
6. Backend function is called with the audio file data

### Implementation

#### Provider Setup (`app/_layout.tsx`)
```tsx
<ShareIntentProvider>
  <AuthProvider>
    {/* Rest of app */}
  </AuthProvider>
</ShareIntentProvider>
```

#### Share Detection (`app/(tabs)/_layout.tsx`)
```tsx
const { hasShareIntent } = useShareIntentContext();

useEffect(() => {
  if (hasShareIntent && isSignedIn) {
    router.push('/(tabs)/import');
  }
}, [hasShareIntent, isSignedIn]);
```

#### Processing (`app/(tabs)/import.tsx`)
The import screen:
- Filters for audio files by MIME type or extension
- Extracts file metadata (path, name, size, etc.)
- Calls your backend function
- Shows success/error feedback
- Resets the share intent and navigates back

## Backend Integration

To integrate with your backend, update the `handleSharedContent` function in `app/(tabs)/import.tsx`:

```tsx
// TODO: Replace this with your actual backend call
for (const audioFile of audioFiles) {
  // Example: Upload to Convex
  // const storageId = await uploadAudioFile(audioFile.path);
  // await processAudio({ storageId, fileName: audioFile.fileName });
  
  console.log('Audio file:', {
    path: audioFile.path,        // Local file path
    fileName: audioFile.fileName, // Original filename
    mimeType: audioFile.mimeType, // e.g., "audio/mp3"
    size: audioFile.size,         // Size in bytes
  });
}
```

## Building & Testing

### Development Build Required
Share intents don't work with Expo Go. You must use a development build:

```bash
# Run postinstall to apply patches
pnpm install

# Prebuild native code
npx expo prebuild --no-install --clean

# Run on device
npx expo run:ios
# or
npx expo run:android
```

### Testing
1. Build and install the app on a physical device or simulator
2. Open Files app or Voice Memos
3. Select an audio file
4. Tap the share button
5. Select "Audora" from the share sheet
6. App should open and process the file

## Supported Audio Formats

The app accepts files with these extensions:
- `.mp3`
- `.wav`
- `.m4a`
- `.aac`
- `.ogg`
- `.flac`

Or any file with MIME type starting with `audio/`

## Troubleshooting

### Share option doesn't appear
- Make sure you've run `npx expo prebuild --clean`
- Rebuild the app completely
- Check that the URL scheme is configured in `app.json`

### App opens but doesn't process file
- Check console logs for errors
- Verify the file is an audio file
- Ensure user is signed in (share intent only works for authenticated users)

### iOS Extension not working
- The xcode patch must be applied via `patch-package`
- Check that `patches/xcode+3.0.1.patch` exists
- Run `pnpm install` to apply patches

## References
- [expo-share-intent GitHub](https://github.com/achorein/expo-share-intent)
- [Expo Linking Docs](https://docs.expo.dev/guides/linking/)
