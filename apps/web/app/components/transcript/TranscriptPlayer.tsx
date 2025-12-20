"use client";
import { api } from "@audora/backend/convex/_generated/api";
import type { Id } from "@audora/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";

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
}

export default function TranscriptPlayer({ conversationId, getUserName }: TranscriptPlayerProps) {
  const transcriptTurns = useQuery(api.conversations.getTranscript, { conversationId }) || [];
  const audioUrl = useQuery(api.conversations.getAudioUrl, { conversationId });
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);

  // Flatten all words with their turn info
  const allWords = transcriptTurns.flatMap((turn) => {
    if (!turn.words || turn.words.length === 0) return [];
    return turn.words.map((word) => ({
      ...word,
      turnId: turn._id,
      userId: turn.userId,
    }));
  });

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
  }, [currentTime, allWords]);

  useEffect(() => {
    if (activeWordId && activeWordRef.current) {
      activeWordRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeWordId]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleWordClick = (word: Word & { turnId: Id<"transcriptTurns"> }) => {
    if (audioRef.current) {
      audioRef.current.currentTime = word.startTime;
      setActiveWordId(word.wordId);
    }
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
      {/* Audio Player */}
      <div className="bg-card border border-border rounded-lg p-4 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={handlePlayPause}
            className="p-2 bg-primary hover:bg-primary/90 rounded-lg transition-colors"
          >
            {isPlaying ? (
              <svg className="w-5 h-5 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 4h4v12H6V4zm4 0h4v12h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.5 4l9 6-9 6V4z" />
              </svg>
            )}
          </button>
          <div className="flex-1 flex items-center gap-3">
            <span className="text-sm text-muted-foreground min-w-[40px]">
              {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, "0")}
            </span>
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
              className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="text-sm text-muted-foreground min-w-[40px]">
              {Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, "0")}
            </span>
          </div>
        </div>
        <audio
          ref={audioRef}
          src={audioUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration);
            }
          }}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }}
        />
      </div>

      {/* Transcript */}
      <div className="bg-card border border-border rounded-lg p-6 flex flex-col flex-1 min-h-0">
        <h3 className="text-lg font-semibold text-foreground mb-4 shrink-0">Transcript</h3>
        <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-3 custom-scrollbar">
          {transcriptTurns.map((turn) => {
            const userName = getUserName(turn.userId);
            const hasWords = turn.words && turn.words.length > 0;

            return (
              <div key={turn._id} className="flex space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-xs font-medium text-primary-foreground">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-foreground">{userName}</span>
                  </div>
                  {hasWords ? (
                    <p className="text-muted-foreground leading-relaxed">
                      {turn.words!.map((word, idx) => {
                        const isActive = activeWordId === word.wordId;
                        return (
                          <span
                            key={word.wordId}
                            ref={isActive ? activeWordRef : null}
                            onClick={() => handleWordClick({ ...word, turnId: turn._id })}
                            className={`
                              ${isActive ? "bg-primary text-primary-foreground px-1 rounded" : ""}
                              ${!isActive ? "hover:bg-muted cursor-pointer px-0.5 rounded" : ""}
                              transition-colors
                            `}
                          >
                            {word.word}
                            {idx < turn.words!.length - 1 && " "}
                          </span>
                        );
                      })}
                    </p>
                  ) : (
                    <p className="text-muted-foreground leading-relaxed">{turn.text}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

