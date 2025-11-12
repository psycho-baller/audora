# Auto-Recording Feature

## Overview

The auto-recording feature automatically starts recording when system audio is detected on macOS and stops after a configurable silence threshold. This enables hands-free operation where the app intelligently captures audio conversations without manual intervention.

## Architecture

### Components

#### 1. SystemAudioMonitor (`Managers/SystemAudioMonitor.swift`)

**Purpose**: Monitors the default system audio output device for activity using Core Audio APIs.

**Key Features**:
- Uses `kAudioDevicePropertyDeviceIsRunningSomewhere` to detect audio activity
- Property listeners notify when audio starts/stops in real-time
- Handles device changes (e.g., switching from speakers to headphones)
- Observable pattern with state publishing

**Core Audio Properties Used**:
- `kAudioDevicePropertyDeviceIsRunningSomewhere`: Detects if audio is flowing through the device
- `kAudioHardwarePropertyDefaultOutputDevice`: Monitors changes in default output device

**State Management**:
```swift
enum AudioState {
    case active   // Audio is currently playing
    case inactive // No audio is playing
}
```

#### 2. AudioManager Extensions (`Managers/AudioManager.swift`)

**New Properties**:
- `isAutoRecordingEnabled`: Published state for UI binding
- `audioMonitor`: Instance of SystemAudioMonitor
- `silenceTimer`: Delays stopping after audio becomes inactive
- `startDelayTimer`: Prevents false positives from brief sounds

**Configuration**:
- `silenceThreshold: 3.0 seconds` - How long to wait after silence before stopping
- `startDelay: 0.5 seconds` - Debounce period before starting recording

**Methods**:

```swift
func enableAutoRecording()
```
- Creates and configures SystemAudioMonitor
- Starts monitoring for audio activity
- Sets up state change callback

```swift
func disableAutoRecording()
```
- Stops monitoring
- Cleans up timers
- Resets state

```swift
private func handleAudioStateChange(_ state: SystemAudioMonitor.AudioState)
```
- Routes state changes to appropriate handlers

```swift
private func handleAudioStarted()
```
- Cancels silence timer
- Starts delay timer to avoid false positives
- Initiates recording if audio persists

```swift
private func handleAudioStopped()
```
- Cancels start delay timer
- Begins silence countdown
- Stops recording after threshold

#### 3. Settings Integration

**UserDefaultsManager** (`Managers/UserDefaultsManager.swift`):
- Persists `autoRecordingEnabled` boolean preference

**Settings Model** (`Models/Settings.swift`):
- Computed property for accessing auto-recording state

**SettingsView** (`Views/SettingsView.swift`):
- Toggle control for enabling/disabling auto-recording
- Visual indicator when feature is active
- Descriptive help text

#### 4. UI Components

**MeetingListView** (`Views/MeetingListView.swift`):
- Toolbar indicator showing when auto-recording is enabled
- Green waveform icon with "Auto" label

**ContentView** (`ContentView.swift`):
- Restores auto-recording state on app launch

## User Experience Flow

### Enabling Auto-Recording

1. User opens **Settings** from the toolbar
2. Toggles **"Enable auto-recording"** switch
3. System requests audio recording permissions (if not already granted)
4. Green "Auto" indicator appears in toolbar
5. SystemAudioMonitor begins watching for audio activity

### Automatic Recording Cycle

```
Audio Detected → Start Delay (0.5s) → Begin Recording
                                            ↓
                                      Audio Playing
                                            ↓
                                    Audio Stops
                                            ↓
                              Silence Threshold (3s)
                                            ↓
                                    Stop Recording
```

### State Transitions

```
[Monitoring] ──audio detected──→ [Waiting to Start]
                                        ↓
                                 (0.5s delay)
                                        ↓
                                   [Recording]
                                        ↓
                                 audio stops
                                        ↓
                                [Silence Timer]
                                        ↓
                                 (3s silence)
                                        ↓
                                [Monitoring]
```

## Technical Details

### Core Audio Property Listening

The feature uses Core Audio's property listener API to receive real-time notifications:

```swift
var address = AudioObjectPropertyAddress(
    mSelector: kAudioDevicePropertyDeviceIsRunningSomewhere,
    mScope: kAudioObjectPropertyScopeGlobal,
    mElement: kAudioObjectPropertyElementMain
)

AudioObjectAddPropertyListener(
    outputDeviceID,
    &address,
    deviceRunningPropertyListener,
    selfPtr
)
```

### C Callback Integration

Swift callback bridged to C function pointer for Core Audio:

```swift
private func deviceRunningPropertyListener(
    inObjectID: AudioObjectID,
    inNumberAddresses: UInt32,
    inAddresses: UnsafePointer<AudioObjectPropertyAddress>,
    inClientData: UnsafeMutableRawPointer?
) -> OSStatus {
    let monitor = Unmanaged<SystemAudioMonitor>
        .fromOpaque(clientData)
        .takeUnretainedValue()
    
    Task { @MainActor in
        monitor.updateAudioState()
    }
    
    return noErr
}
```

### Memory Management

- Uses `Unmanaged` to pass Swift object references to C callbacks
- `takeUnretainedValue()` ensures no retain cycle
- Proper cleanup in `deinit` and `stopMonitoring()`

### Device Change Handling

When the user switches audio output devices:

1. Listener detects `kAudioHardwarePropertyDefaultOutputDevice` change
2. Removes listener from old device
3. Queries new default output device
4. Adds listener to new device
5. Updates audio state

## Configuration Options

Users can customize behavior through settings:

| Setting | Default | Description |
|---------|---------|-------------|
| Auto-recording enabled | `false` | Master toggle for the feature |
| Silence threshold | `3.0s` | How long to wait before stopping |
| Start delay | `0.5s` | Debounce period before starting |

## Error Handling

### Permission Failures
- If audio recording permission is denied, shows error message
- Feature automatically disables
- User directed to system preferences

### Device Errors
- Handles invalid device IDs gracefully
- Logs errors to system logger
- Falls back to disabled state

### State Consistency
- Checks for stale recording sessions
- Validates audio monitor state before operations
- Cleans up timers on disable

## Performance Considerations

### Efficiency
- Event-driven (no polling)
- Property listeners fire only on state changes
- Minimal CPU impact when idle

### Battery Impact
- Core Audio listeners are native and efficient
- No continuous background processing
- Only activates ProcessTap when recording

## Privacy & Security

### Permissions Required
- **Microphone Access**: Required for recording
- **System Audio Recording**: Required via TCC (kTCCServiceAudioCapture)

### User Control
- Explicit opt-in required
- Clear visual indicators when active
- Can be disabled at any time

### Data Handling
- All recording handled by existing AudioManager
- No additional data collection
- Same privacy policy as manual recording

## Debugging

### Console Logs

The feature includes comprehensive logging:

```
🎵 Enabling auto-recording...
✅ Auto-recording enabled - will start when system audio plays
🎵 System audio detected
🎙️ Starting auto-recording...
🔇 System audio stopped
⏸️ Silence threshold reached - stopping auto-recording
```

### OSLog Categories

- `SystemAudioMonitor`: Property listener events
- `AudioManager`: Recording state changes

### Common Issues

**Auto-recording doesn't start**:
- Check system audio permission is granted
- Verify audio is actually playing through speakers/headphones (not muted)
- Check logs for error messages

**Stops too quickly**:
- Brief pauses in audio trigger silence timer
- Consider adjusting `silenceThreshold` if needed

**Starts on system sounds**:
- `startDelay` helps filter brief sounds
- May need to increase delay for notification-heavy systems

## Testing

### Manual Tests

1. **Enable/Disable**
   - Toggle auto-recording in settings
   - Verify indicator appears/disappears in toolbar

2. **Start Detection**
   - Play audio (music, video, etc.)
   - Verify recording starts after 0.5s

3. **Stop Detection**
   - Pause audio
   - Verify recording stops after 3s

4. **Device Switching**
   - Switch between speakers and headphones
   - Verify monitoring continues on new device

5. **Permission Handling**
   - Enable without permissions
   - Verify error message and graceful failure

### Edge Cases

- Rapid on/off audio toggling
- Device changes during recording
- App backgrounding/foregrounding
- System sleep/wake
- Multiple audio sources simultaneously

## Future Enhancements

### Potential Improvements

1. **Smart Detection**
   - Distinguish between speech and music
   - Filter out notification sounds automatically
   - Machine learning for audio classification

2. **Configurable Settings**
   - User-adjustable silence threshold (1-10s)
   - Minimum recording duration filter
   - Exclude specific apps from triggering

3. **Advanced Monitoring**
   - Per-app audio monitoring
   - Volume threshold detection
   - Frequency analysis for speech detection

4. **Status Enhancements**
   - Real-time audio level in indicator
   - Notification when recording starts
   - Menu bar extra with quick controls

## API Reference

### SystemAudioMonitor

```swift
@MainActor
@Observable
final class SystemAudioMonitor {
    enum AudioState {
        case active, inactive
    }
    
    var audioState: AudioState { get }
    var isMonitoring: Bool { get }
    var onAudioStateChanged: ((AudioState) -> Void)?
    
    func startMonitoring() throws
    func stopMonitoring()
}
```

### AudioManager Extensions

```swift
@MainActor
class AudioManager {
    @Published var isAutoRecordingEnabled: Bool
    
    func enableAutoRecording()
    func disableAutoRecording()
}
```

## Related Files

### New Files
- `/Managers/SystemAudioMonitor.swift` - Core audio monitoring
- `/docs/AUTO_RECORDING_FEATURE.md` - This documentation

### Modified Files
- `/Managers/AudioManager.swift` - Auto-recording integration
- `/Managers/UserDefaultsManager.swift` - Settings persistence
- `/Models/Settings.swift` - Settings model
- `/Views/SettingsView.swift` - UI controls
- `/Views/MeetingListView.swift` - Status indicator
- `/Views/ContentView.swift` - State restoration

## Credits

Implemented using Apple's Core Audio framework and HAL (Hardware Abstraction Layer) APIs.

## References

- [Core Audio Overview](https://developer.apple.com/documentation/coreaudio)
- [Audio Hardware Services](https://developer.apple.com/documentation/coreaudio/audio_hardware_services)
- [Property Listeners](https://developer.apple.com/documentation/coreaudio/1422524-audioobjectaddpropertylistener)
