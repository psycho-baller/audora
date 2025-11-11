import time
import subprocess
from pocketsphinx import LiveSpeech

# Define filler words to detect
filler_words = {
    "like",
    "um",
    "uh",
    "you know",
    "so",
    "basically",
    "literally",
    "actually",
}
# Set up LiveSpeech for continuous recognition (no keyphrase)
speech = LiveSpeech()

# Cooldown period in seconds to prevent frequent sound plays
cooldown = 1
last_played = 0


def play_error_sound():
    """Play the error sound if the cooldown period has passed."""
    global last_played
    current_time = time.time()
    if current_time - last_played > cooldown:
        # Use macOS's built-in afplay command (non-blocking)
        subprocess.Popen(["afplay", "error.mp3"])
        last_played = current_time


# Continuously listen for the keyword and play sound when detected
try:
    for phrase in speech:
        text = str(phrase).lower()
        print(f"Transcribed: {text}")
        # Check if any filler word is in the transcription
        for filler in filler_words:
            if filler in text:
                print(f" ⚠️ Filler word detected: '{filler}'")
                play_error_sound()
                break  # Only play sound once per phrase
except KeyboardInterrupt:
    print("Stopping...")
