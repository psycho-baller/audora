import { createContext, useCallback, useContext, useState, type ReactNode, type RefObject } from "react";

interface AudioPlaybackContextType {
  // Current playback state
  currentTime: number;
  duration: number;
  isPlaying: boolean;

  // Seek to a specific time (and optionally start playing)
  seekTo: (time: number, autoPlay?: boolean) => void;

  // Register the audio element ref (called by TranscriptPlayer)
  registerAudioRef: (ref: RefObject<HTMLAudioElement>) => void;

  // Update current time (called by TranscriptPlayer on timeupdate)
  updateCurrentTime: (time: number) => void;
  updateDuration: (duration: number) => void;
  updateIsPlaying: (playing: boolean) => void;

  // Highlighted word ID from analytics click
  highlightedWordId: string | null;
  setHighlightedWordId: (wordId: string | null) => void;
}

const AudioPlaybackContext = createContext<AudioPlaybackContextType | null>(null);

export function AudioPlaybackProvider({ children }: { children: ReactNode }) {
  const [audioRef, setAudioRef] = useState<RefObject<HTMLAudioElement> | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [highlightedWordId, setHighlightedWordId] = useState<string | null>(null);

  const registerAudioRef = useCallback((ref: RefObject<HTMLAudioElement>) => {
    setAudioRef(ref);
  }, []);

  const seekTo = useCallback((time: number, autoPlay: boolean = true) => {
    if (audioRef?.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      if (autoPlay && audioRef.current.paused) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  }, [audioRef]);

  const updateCurrentTime = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const updateDuration = useCallback((dur: number) => {
    setDuration(dur);
  }, []);

  const updateIsPlaying = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  return (
    <AudioPlaybackContext.Provider
      value={{
        currentTime,
        duration,
        isPlaying,
        seekTo,
        registerAudioRef,
        updateCurrentTime,
        updateDuration,
        updateIsPlaying,
        highlightedWordId,
        setHighlightedWordId,
      }}
    >
      {children}
    </AudioPlaybackContext.Provider>
  );
}

export function useAudioPlayback() {
  const context = useContext(AudioPlaybackContext);
  if (!context) {
    throw new Error("useAudioPlayback must be used within an AudioPlaybackProvider");
  }
  return context;
}

// Optional hook that returns null if not in provider (for optional usage)
export function useAudioPlaybackOptional() {
  return useContext(AudioPlaybackContext);
}
