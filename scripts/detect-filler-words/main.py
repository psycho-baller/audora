import time
import subprocess
from pocketsphinx import LiveSpeech

# Define the keyword to listen for
keyword = "like"

# Set up LiveSpeech for keyword spotting
speech = LiveSpeech(keyphrase=keyword, kws_threshold=1e-10)

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
        if phrase:
            print(f"Detected: {phrase}")
            play_error_sound()
except KeyboardInterrupt:
    print("Stopping...")
