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
    if (!audioRef.current || allWords.length === 0) return;

    const handleTimeUpdate = () => {
      const time = audioRef.current?.currentTime ?? 0;
      setCurrentTime(time);

      // Binary search for active word
      const word = allWords.find(
        (w) => time >= w.startTime && time < w.endTime
      );

      if (word) {
        setActiveWordId(word.wordId);
      } else {
        // Find closest word
        const nextWord = allWords.find((w) => w.startTime > time);
        if (nextWord && time < nextWord.startTime + 0.5) {
          setActiveWordId(null);
        }
      }
    };

    audioRef.current.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      audioRef.current?.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [allWords]);

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
    <div className="space-y-4">
      {/* Audio Player */}
      <div className="bg-card border border-border rounded-lg p-4">
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
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">
              {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, "0")}
            </div>
          </div>
        </div>
        <audio
          ref={audioRef}
          src={audioUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      </div>

      {/* Transcript */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Transcript</h3>
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
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

