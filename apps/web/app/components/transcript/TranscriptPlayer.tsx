import { api } from "@audora/backend/convex/_generated/api";
import type { Id } from "@audora/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { AlertCircle, Pause, Play, PlayCircle, SkipBack, SkipForward, Target, Waves, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Waveform } from "~/components/audio/Waveform";
import { useAudioPlaybackOptional } from "~/hooks/use-audio-playback";

// Format seconds to MM:SS
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

interface Word {
  word: string;
  startTime: number;
  endTime: number;
  wordId: string;
}

interface TranscriptTurn {
  _id: Id<"transcriptTurns">;
  text: string;
  userId?: Id<"users">;
  words?: Word[];
}

interface TranscriptPlayerProps {
  conversationId: Id<"conversations">;
  getUserName: (userId?: Id<"users">) => string;
  children?: React.ReactNode;
}

type HighlightType = "filler" | "weak" | "starter" | null;

interface WordHighlight {
  wordId: string;
  type: HighlightType;
  word: string;
}

export default function TranscriptPlayer({ conversationId, getUserName, children }: TranscriptPlayerProps) {
  const transcriptTurns = useQuery(api.conversations.getTranscript, { conversationId }) || [];
  const audioUrl = useQuery(api.conversations.getAudioUrl, { conversationId });
  const speakers = useQuery(api.conversations.getSpeakers, { conversationId });
  const currentUser = useQuery(api.users.getCurrentUser);
  const analytics = useQuery(
    api.analytics.getAnalytics,
    currentUser && conversationId
      ? { conversationId, userId: currentUser._id }
      : "skip"
  );
  
  // Audio playback context for syncing with analytics panel
  const audioPlayback = useAudioPlaybackOptional();

  // Enhanced getUserName that uses speaker data
  const getSpeakerName = (userId?: Id<"users">) => {
    if (!userId) return "Unknown Speaker";
    if (speakers && speakers[userId]) {
      return speakers[userId].name;
    }
    return getUserName(userId);
  };

  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const [showWaveform, setShowWaveform] = useState(false);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  
  // Register audio ref with context for external control
  useEffect(() => {
    if (audioPlayback && audioRef.current) {
      audioPlayback.registerAudioRef(audioRef as React.RefObject<HTMLAudioElement>);
    }
  }, [audioPlayback, audioUrl]); // Re-register when audio URL changes

  // Flatten all words with their turn info - memoized to prevent recalculation on every render
  const allWords = useMemo(() => {
    return transcriptTurns.flatMap((turn) => {
      if (!turn.words || turn.words.length === 0) return [];
      return turn.words.map((word) => ({
        ...word,
        turnId: turn._id,
        userId: turn.userId,
      }));
    });
  }, [transcriptTurns]);

  // Build word highlight map from analytics
  const wordHighlights = useMemo<Map<string, WordHighlight>>(() => {
    const highlights = new Map<string, WordHighlight>();

    if (!analytics || !currentUser) return highlights;

    // Map filler words
    if (analytics.fillerWords?.instances) {
      // We need to find the actual word positions in the transcript
      let wordIndex = 0;
      transcriptTurns.forEach((turn) => {
        if (turn.userId === currentUser._id && turn.words) {
          turn.words.forEach((word) => {
            const lowerWord = word.word.toLowerCase().replace(/[.,!?;:]/g, "");
            // Check if this word matches any filler word
            const fillerWord = analytics.fillerWords.instances.find(
              (f) => f.word.toLowerCase() === lowerWord
            );
            if (fillerWord) {
              highlights.set(word.wordId, {
                wordId: word.wordId,
                type: "filler",
                word: word.word,
              });
            }
            wordIndex++;
          });
        }
      });
    }

    // Map weak words
    if (analytics.weakWords) {
      transcriptTurns.forEach((turn) => {
        if (turn.userId === currentUser._id && turn.words) {
          turn.words.forEach((word) => {
            const lowerWord = word.word.toLowerCase().replace(/[.,!?;:]/g, "");
            const weakWord = analytics.weakWords.find(
              (w) => w.word.toLowerCase() === lowerWord
            );
            if (weakWord && !highlights.has(word.wordId)) {
              highlights.set(word.wordId, {
                wordId: word.wordId,
                type: "weak",
                word: word.word,
              });
            }
          });
        }
      });
    }

    // Map sentence starters (first word of sentences)
    if (analytics.sentenceStarters?.weak) {
      transcriptTurns.forEach((turn) => {
        if (turn.userId === currentUser._id && turn.words && turn.words.length > 0) {
          const firstWord = turn.words[0];
          const lowerWord = firstWord.word.toLowerCase().replace(/[.,!?;:]/g, "");
          const starter = analytics.sentenceStarters.weak.find(
            (s) => s.word.toLowerCase() === lowerWord
          );
          if (starter && !highlights.has(firstWord.wordId)) {
            highlights.set(firstWord.wordId, {
              wordId: firstWord.wordId,
              type: "starter",
              word: firstWord.word,
            });
          }
        }
      });
    }

    return highlights;
  }, [analytics, transcriptTurns, currentUser]);

  // Find active word based on current time
  useEffect(() => {
    if (allWords.length === 0) return;

    // Find the word that matches the current time
    const word = allWords.find(
      (w) => currentTime >= w.startTime && currentTime < w.endTime
    );

    if (word) {
      setActiveWordId(word.wordId);
    } else {
      // Clear active word if not in any word's time range
      setActiveWordId(null);
    }
  }, [currentTime, transcriptTurns]); // Use transcriptTurns instead of allWords for stable reference

  useEffect(() => {
    if (activeWordId && activeWordRef.current) {
      activeWordRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeWordId]);

  // Handle external word highlighting from analytics panel
  useEffect(() => {
    if (audioPlayback?.highlightedWordId) {
      // Find the word and seek to it
      const targetWord = allWords.find(w => w.wordId === audioPlayback.highlightedWordId);
      if (targetWord && audioRef.current) {
        audioRef.current.currentTime = targetWord.startTime;
        setCurrentTime(targetWord.startTime);
        setActiveWordId(targetWord.wordId);
        // Start playing
        audioRef.current.play();
        setIsPlaying(true);
      }
      // Clear the highlighted word after seeking
      audioPlayback.setHighlightedWordId(null);
    }
  }, [audioPlayback?.highlightedWordId, allWords]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Determine skip interval based on conversation length
  const skipInterval = duration > 10 ? 10 : 2;
  
  const handleSkip = (direction: 1 | -1) => {
    if (audioRef.current) {
      const skipAmount = direction * skipInterval;
      audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + skipAmount));
    }
  };

  const handleWaveformSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleWordClick = (word: Word & { turnId: Id<"transcriptTurns"> }) => {
    if (audioRef.current) {
      audioRef.current.currentTime = word.startTime;
      setActiveWordId(word.wordId);
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // Calculate timeline markers for highlights
  const timelineMarkers = useMemo(() => {
    const markers: Array<{ time: number; type: HighlightType; word: string }> = [];

    allWords.forEach((word) => {
      const highlight = wordHighlights.get(word.wordId);
      if (highlight) {
        markers.push({
          time: word.startTime,
          type: highlight.type,
          word: highlight.word,
        });
      }
    });

    return markers;
  }, [allWords, wordHighlights]);

  const getWordClassName = (word: Word, isActive: boolean) => {
    const highlight = wordHighlights.get(word.wordId);
    // Use consistent padding and box-decoration to prevent layout shifts
    // All words have the same box model, only colors/shadows change
    const baseClasses = "transition-colors duration-200 inline px-0.5 py-0.5 rounded cursor-pointer";
    
    if (isActive) {
      return `${baseClasses} bg-primary text-primary-foreground font-semibold shadow-sm`;
    }
    
    if (highlight) {
      switch (highlight.type) {
        case "filler":
          return `${baseClasses} bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 font-medium shadow-[inset_0_-2px_0_0_rgba(234,179,8,0.6)] hover:bg-yellow-500/25`;
        case "weak":
          return `${baseClasses} bg-orange-500/15 text-orange-800 dark:text-orange-300 font-medium shadow-[inset_0_-2px_0_0_rgba(249,115,22,0.6)] hover:bg-orange-500/25`;
        case "starter":
          return `${baseClasses} bg-blue-500/15 text-blue-800 dark:text-blue-300 font-medium shadow-[inset_0_-2px_0_0_rgba(59,130,246,0.6)] hover:bg-blue-500/25`;
      }
    }
    
    return `${baseClasses} hover:bg-muted/60`;
  };

  if (!audioUrl) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground text-center">No audio available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 space-y-4">
      {/* Enhanced Audio Player */}
      <div className="bg-card border border-border rounded-xl p-5 shrink-0 shadow-sm">
        <div className="flex items-center gap-4 mb-3">
          <button
            onClick={handlePlayPause}
            className="p-4 bg-primary hover:bg-primary/90 rounded-full transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-primary-foreground" fill="currentColor" />
            ) : (
              <Play className="w-6 h-6 text-primary-foreground ml-0.5" fill="currentColor" />
            )}
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleSkip(-1)}
              className="flex flex-col items-center p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label={`Skip back ${skipInterval} seconds`}
            >
              <SkipBack className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground mt-0.5">-{skipInterval}s</span>
            </button>
            <button
              onClick={() => handleSkip(1)}
              className="flex flex-col items-center p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label={`Skip forward ${skipInterval} seconds`}
            >
              <SkipForward className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground mt-0.5">+{skipInterval}s</span>
            </button>
          </div>

              <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-muted-foreground min-w-[50px] text-right tabular-nums">
                {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, "0")}
              </span>
              <div className="flex-1 relative">
                {showWaveform ? (
                  /* Waveform visualization */
                  <div className="relative">
                    <Waveform
                      audioUrl={audioUrl}
                      currentTime={currentTime}
                      duration={duration}
                      onSeek={handleWaveformSeek}
                      className="h-16"
                    />
                    {/* Timeline markers overlay */}
                    <div className="absolute inset-x-0 top-0 h-full flex items-center pointer-events-none">
                      {timelineMarkers.map((marker, i) => {
                        const position = (marker.time / (duration || 100)) * 100;
                        let color = "bg-yellow-500";
                        if (marker.type === "weak") color = "bg-orange-500";
                        if (marker.type === "starter") color = "bg-blue-500";

                        return (
                          <div
                            key={`${marker.time}-${i}`}
                            className={`absolute w-1 h-4 ${color} rounded-full opacity-70`}
                            style={{ left: `${position}%`, transform: 'translateX(-50%)', top: '4px' }}
                            title={`${marker.type}: ${marker.word}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Timeline with markers */
                  <div className="relative h-10 flex items-center">
                    {/* Timeline markers */}
                    <div className="absolute inset-x-0 top-0 h-6 flex items-center pointer-events-none">
                      {timelineMarkers.map((marker, i) => {
                        const position = (marker.time / (duration || 100)) * 100;
                        let color = "bg-yellow-500";
                        if (marker.type === "weak") color = "bg-orange-500";
                        if (marker.type === "starter") color = "bg-blue-500";

                        return (
                          <div
                            key={`${marker.time}-${i}`}
                            className={`absolute w-1 h-3 ${color} rounded-full opacity-60 hover:opacity-100 transition-opacity`}
                            style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                            title={`${marker.type}: ${marker.word}`}
                          />
                        );
                      })}
                    </div>

                    {/* Progress bar */}
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={(e) => {
                        const newTime = parseFloat(e.target.value);
                        if (audioRef.current) {
                          audioRef.current.currentTime = newTime;
                        }
                        setCurrentTime(newTime);
                      }}
                      className="w-full h-2 bg-muted/50 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md hover:[&::-moz-range-thumb]:scale-110 [&::-moz-range-thumb]:transition-transform relative z-10"
                      style={{
                        background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${(currentTime / (duration || 100)) * 100}%, hsl(var(--muted) / 0.3) ${(currentTime / (duration || 100)) * 100}%, hsl(var(--muted) / 0.3) 100%)`
                      }}
                    />
                  </div>
                )}
              </div>
              <span className="text-sm font-mono text-muted-foreground min-w-[50px] tabular-nums">
                {Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, "0")}
              </span>
              <button
                onClick={() => setShowWaveform(!showWaveform)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                aria-label="Toggle waveform"
                title={showWaveform ? "Show simple timeline" : "Show waveform"}
              >
                <Waves className={`w-4 h-4 ${showWaveform ? 'text-primary' : 'text-muted-foreground'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Highlight legend */}
        {wordHighlights.size > 0 && (
          <div className="flex items-center gap-4 pt-3 border-t border-border/50">
            <span className="text-xs text-muted-foreground font-medium">Timeline markers:</span>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                <span className="text-muted-foreground">Filler words</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-orange-500 rounded-full" />
                <span className="text-muted-foreground">Weak words</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-muted-foreground">Sentence starters</span>
              </div>
            </div>
          </div>
        )}

        <audio
          ref={audioRef}
          src={audioUrl}
          onPlay={() => {
            setIsPlaying(true);
            audioPlayback?.updateIsPlaying(true);
          }}
          onPause={() => {
            setIsPlaying(false);
            audioPlayback?.updateIsPlaying(false);
          }}
          onEnded={() => {
            setIsPlaying(false);
            audioPlayback?.updateIsPlaying(false);
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration);
              audioPlayback?.updateDuration(audioRef.current.duration);
            }
          }}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
              audioPlayback?.updateCurrentTime(audioRef.current.currentTime);
            }
          }}
        />
      </div>

      {/* Enhanced Transcript */}
      <div className="bg-card border border-border rounded-xl p-6 pb-16 flex flex-col flex-1 min-h-0 shadow-sm relative">
        <div className="flex items-center justify-between mb-5 shrink-0 pb-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">Transcript</h3>
            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
              {transcriptTurns.length} turns
            </span>
          </div>
          {wordHighlights.size > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 bg-yellow-500/10 px-2 py-1 rounded-md border border-yellow-500/20">
                <AlertCircle className="w-3 h-3 text-yellow-600 dark:text-yellow-500" />
                <span className="text-yellow-700 dark:text-yellow-400 font-medium">Filler</span>
              </div>
              <div className="flex items-center gap-1.5 bg-orange-500/10 px-2 py-1 rounded-md border border-orange-500/20">
                <Zap className="w-3 h-3 text-orange-600 dark:text-orange-500" />
                <span className="text-orange-700 dark:text-orange-400 font-medium">Weak</span>
              </div>
              <div className="flex items-center gap-1.5 bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">
                <Target className="w-3 h-3 text-blue-600 dark:text-blue-500" />
                <span className="text-blue-700 dark:text-blue-400 font-medium">Starter</span>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-5 overflow-y-auto flex-1 min-h-0 pr-3 custom-scrollbar">
          {transcriptTurns.map((turn, turnIndex) => {
            const userName = getSpeakerName(turn.userId);
            const hasWords = turn.words && turn.words.length > 0;
            const isFirstTurn = turnIndex === 0;
            const prevTurn = turnIndex > 0 ? transcriptTurns[turnIndex - 1] : null;
            const sameSpeaker = prevTurn?.userId === turn.userId;
            const isCurrentUser = currentUser && turn.userId === currentUser._id;
            
            // Get the start time for this turn (from first word or turn timestamp)
            const turnStartTime = hasWords && turn.words![0] 
              ? turn.words![0].startTime 
              : (turn.timestamp ?? null);

            // Different colors for different speakers
            const avatarGradient = isCurrentUser
              ? "bg-gradient-to-br from-primary via-primary to-accent"
              : "bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600";

            return (
              <div key={turn._id} className={`flex gap-3 group transition-all ${!sameSpeaker && !isFirstTurn ? 'pt-3 mt-1 border-t border-border/30' : ''}`}>
                {/* Clickable timestamp button (like Yoodli) */}
                <div className="flex-shrink-0 w-14">
                  {turnStartTime !== null && (
                    <button
                      onClick={() => {
                        if (audioRef.current) {
                          audioRef.current.currentTime = turnStartTime;
                          setCurrentTime(turnStartTime);
                          if (!isPlaying) {
                            audioRef.current.play();
                            setIsPlaying(true);
                          }
                        }
                      }}
                      className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-primary transition-colors cursor-pointer group/timestamp"
                      title={`Jump to ${formatTimestamp(turnStartTime)}`}
                    >
                      <PlayCircle className="w-3 h-3 opacity-0 group-hover/timestamp:opacity-100 transition-opacity" />
                      <span>{formatTimestamp(turnStartTime)}</span>
                    </button>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <div className={`w-9 h-9 rounded-full ${avatarGradient} flex items-center justify-center text-sm font-semibold text-white shadow-md ring-2 ring-background`}>
                    {userName.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-sm font-semibold text-foreground">{userName}</span>
                    {isCurrentUser && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-medium">
                        You
                      </span>
                    )}
                  </div>
                  {hasWords ? (
                    <p className="text-foreground leading-relaxed text-[15px]">
                      {turn.words!.map((word, idx) => {
                        const isActive = activeWordId === word.wordId;
                        return (
                          <span
                            key={word.wordId}
                            ref={isActive ? activeWordRef : null}
                            onClick={() => handleWordClick({ ...word, turnId: turn._id })}
                            className={getWordClassName(word, isActive)}
                            title={wordHighlights.get(word.wordId)?.type || undefined}
                          >
                            {word.word}
                            {idx < turn.words!.length - 1 && " "}
                          </span>
                        );
                      })}
                    </p>
                  ) : (
                    <p className="text-muted-foreground leading-relaxed text-[15px]">{turn.text}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {children}
      </div>
    </div>
  );
}
