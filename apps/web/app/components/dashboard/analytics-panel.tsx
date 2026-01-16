import { api } from "@audora/backend/convex/_generated/api";
import type { Id } from "@audora/backend/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import {
    ChevronRight,
    Clock,
    Loader2,
    Minus,
    Play,
    Sparkles,
    TrendingDown,
    TrendingUp
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PersonalizedFeedback } from "~/components/analytics/PersonalizedFeedback";
import { useAudioPlaybackOptional } from "~/hooks/use-audio-playback";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

// Format seconds to MM:SS
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Clickable timestamp button component
function TimestampButton({ 
  time, 
  wordId,
  label,
  onClick 
}: { 
  time: number; 
  wordId?: string;
  label?: string;
  onClick: (time: number, wordId?: string) => void;
}) {
  return (
    <button
      onClick={() => onClick(time, wordId)}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors cursor-pointer"
      title={`Jump to ${formatTimestamp(time)}`}
    >
      <Play className="w-2.5 h-2.5" fill="currentColor" />
      {label || formatTimestamp(time)}
    </button>
  );
}

// Pacing Gauge Component
function PacingGauge({ wpm }: { wpm: number }) {
  // WPM ranges: Slow < 100, Conversational 100-160, Fast > 160
  // Map WPM to angle: 0 (slow) to 180 (fast)
  const minWpm = 60;
  const maxWpm = 200;
  const clampedWpm = Math.max(minWpm, Math.min(maxWpm, wpm));
  const percentage = (clampedWpm - minWpm) / (maxWpm - minWpm);
  const angle = percentage * 180;

  // Calculate the arc path length for the filled portion
  // The arc goes from angle 0 to 180 degrees (left to right)
  // We need to calculate how much of the arc to fill based on the needle position
  const arcLength = Math.PI * 45; // Total arc length (half circle with radius 45)
  const filledLength = arcLength * percentage;
  const unfilledLength = arcLength - filledLength;

  // Determine label
  let label = "Conversational";
  if (wpm < 100) label = "Slow";
  else if (wpm > 160) label = "Fast";

  return (
    <div className="flex flex-col items-center py-4">
      {/* Gauge container with labels positioned absolutely */}
      <div className="relative w-44">
        {/* Slow label - positioned at left end of arc */}
        <span className="absolute -left-1 top-8 text-[10px] text-muted-foreground -rotate-45 origin-center">Slow</span>
        {/* Conversational label - positioned at top center */}
        <span className="absolute left-1/2 -translate-x-1/2 top-0 text-[10px] text-muted-foreground">Conversational</span>
        {/* Fast label - positioned at right end of arc */}
        <span className="absolute -right-1 top-8 text-[10px] text-muted-foreground rotate-45 origin-center">Fast</span>

        {/* Gauge SVG */}
        <div className="w-40 h-20 mx-auto mt-4">
          <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
            {/* Grey background arc */}
            <path
              d="M 5 50 A 45 45 0 0 1 95 50"
              fill="none"
              stroke="#e5e5e5"
              strokeWidth="8"
              strokeLinecap="round"
            />
            {/* Purple filled arc up to needle position */}
            <path
              d="M 5 50 A 45 45 0 0 1 95 50"
              fill="none"
              stroke="#a855f7"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${filledLength} ${unfilledLength}`}
            />
            {/* Needle */}
            <g transform={`rotate(${angle - 90}, 50, 50)`}>
              <line
                x1="50"
                y1="50"
                x2="50"
                y2="15"
                stroke="currentColor"
                strokeWidth="2"
                className="text-foreground"
              />
              <circle cx="50" cy="50" r="4" fill="currentColor" className="text-foreground" />
            </g>
          </svg>
        </div>
      </div>
      {/* Result label and WPM below gauge */}
      <p className="text-sm font-medium text-foreground mt-2">{label}</p>
      <p className="text-2xl font-bold text-foreground">{wpm} <span className="text-sm font-normal text-muted-foreground">wpm</span></p>
    </div>
  );
}

// Pacing Variation Chart Component
function PacingVariationChart({
  wpm,
  segments,
  durationSeconds
}: {
  wpm: number;
  segments?: Array<{ startTime: number; endTime: number; wpm: number }>;
  durationSeconds?: number;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Use real segment data if available, otherwise generate placeholder based on overall WPM
  const data = segments && segments.length > 0
    ? segments.map(s => s.wpm)
    : (() => {
        // Generate placeholder data when no segments available
        const points = [];
        for (let i = 0; i <= 10; i++) {
          const variation = (Math.sin(i * 0.5) * 30) + (Math.cos(i * 0.3) * 15);
          points.push(wpm + variation);
        }
        return points;
      })();

  // Calculate total duration
  const totalDuration = durationSeconds || (segments && segments.length > 0
    ? segments[segments.length - 1].endTime
    : 300); // Default to 5 minutes if no data

  // Dynamic min/max based on actual data, but always include conversational range (100-160)
  const dataMin = Math.min(...data);
  const dataMax = Math.max(...data);
  // Ensure conversational zone (100-160) is always visible
  const rangeMin = Math.min(dataMin, 100);
  const rangeMax = Math.max(dataMax, 160);
  // Add 10% padding to the range
  const padding = Math.max((rangeMax - rangeMin) * 0.1, 10);
  const minVal = Math.floor(rangeMin - padding);
  const maxVal = Math.ceil(rangeMax + padding);
  const midVal = Math.round((minVal + maxVal) / 2);
  const range = maxVal - minVal;

  // SVG dimensions
  const width = 100;
  const height = 60;

  // Format time helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Calculate point coordinates
  const pointCoords = data.map((val, i) => {
    const timeInSegment = segments && segments[i]
      ? (segments[i].startTime + segments[i].endTime) / 2
      : (i / (data.length - 1)) * totalDuration;

    return {
      x: (i / (data.length - 1)) * width,
      y: height - ((val - minVal) / range) * height,
      value: Math.round(val),
      time: formatTime(timeInSegment)
    };
  });

  // Create smooth bezier curve path
  const createSmoothPath = () => {
    if (pointCoords.length < 2) return '';

    let path = `M ${pointCoords[0].x},${pointCoords[0].y}`;

    for (let i = 0; i < pointCoords.length - 1; i++) {
      const current = pointCoords[i];
      const next = pointCoords[i + 1];
      const prev = pointCoords[i - 1] || current;
      const nextNext = pointCoords[i + 2] || next;

      // Calculate control points for smooth curve
      const tension = 0.3;
      const cp1x = current.x + (next.x - prev.x) * tension;
      const cp1y = current.y + (next.y - prev.y) * tension;
      const cp2x = next.x - (nextNext.x - current.x) * tension;
      const cp2y = next.y - (nextNext.y - current.y) * tension;

      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`;
    }

    return path;
  };

  const smoothPath = createSmoothPath();

  // Conversational zone (100-160 WPM) - always fixed at exactly 100-160
  const zoneTop = height - ((160 - minVal) / range) * height;
  const zoneBottom = height - ((100 - minVal) / range) * height;
  const zoneHeight = zoneBottom - zoneTop;

  // Generate x-axis time labels
  const timeLabels = [];
  const numLabels = Math.min(5, Math.ceil(totalDuration / 60) + 1);
  for (let i = 0; i < numLabels; i++) {
    const time = (i / (numLabels - 1)) * totalDuration;
    timeLabels.push(formatTime(time));
  }

  // Calculate Y positions as percentages for HTML labels
  const y160Percent = (zoneTop / height) * 100;
  const y100Percent = (zoneBottom / height) * 100;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <h5 className="text-sm font-medium text-foreground">Pacing Variation</h5>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 bg-primary/20 rounded-sm" />
          <span className="text-[10px] text-muted-foreground">Conversational (100-160)</span>
        </div>
      </div>
      <div className="relative bg-muted/20 rounded-lg p-2">
        {/* Chart with Y-axis labels */}
        <div className="flex">
          {/* Y-axis labels */}
          <div className="relative w-8 h-24 flex-shrink-0 text-[10px] text-muted-foreground">
            <span className="absolute right-1 top-0 -translate-y-1/2">{maxVal}</span>
            <span className="absolute right-1 text-primary/70" style={{ top: `${y160Percent}%`, transform: 'translateY(-50%)' }}>160</span>
            <span className="absolute right-1 text-primary/70" style={{ top: `${y100Percent}%`, transform: 'translateY(-50%)' }}>100</span>
            <span className="absolute right-1 bottom-0 translate-y-1/2">{minVal}</span>
          </div>
          {/* Chart area */}
          <div className="flex-1 relative">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24" preserveAspectRatio="none">
              {/* Conversational zone highlight (always shown at 100-160 WPM) */}
              <rect
              x="0"
              y={zoneTop}
              width={width}
              height={zoneHeight}
              fill="currentColor"
              className="text-primary/10"
            />
            {/* Grid lines at 100 and 160 WPM boundaries */}
            <line x1="0" y1={zoneTop} x2={width} y2={zoneTop} stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground/30" strokeDasharray="2,2" style={{ pointerEvents: 'none' }} />
            <line x1="0" y1={zoneBottom} x2={width} y2={zoneBottom} stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground/30" strokeDasharray="2,2" style={{ pointerEvents: 'none' }} />
            {/* Smooth line chart */}
            <path
              d={smoothPath}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-primary"
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'none' }}
            />
            {/* Hover vertical line */}
            {hoveredIndex !== null && (
              <line
                x1={pointCoords[hoveredIndex].x}
                y1={0}
                x2={pointCoords[hoveredIndex].x}
                y2={height}
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-muted-foreground"
                strokeDasharray="2,1"
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }}
              />
            )}
            {/* Interactive hover areas */}
            {pointCoords.map((point, i) => (
              <rect
                key={i}
                x={point.x - (width / data.length / 2)}
                y={0}
                width={width / data.length}
                height={height}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            ))}
            {/* Hover point indicator */}
            {hoveredIndex !== null && (
              <circle
                cx={pointCoords[hoveredIndex].x}
                cy={pointCoords[hoveredIndex].y}
                r="3"
                fill="currentColor"
                className="text-primary"
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }}
              />
            )}
          </svg>
          {/* Tooltip */}
          {hoveredIndex !== null && (
            <div
              className="absolute bg-popover text-popover-foreground border border-border rounded-md px-2 py-1 text-xs shadow-md pointer-events-none z-10"
              style={{
                left: `${(pointCoords[hoveredIndex].x / width) * 100}%`,
                top: `${(pointCoords[hoveredIndex].y / height) * 100}%`,
                transform: 'translate(-50%, -120%)'
              }}
            >
              <div className="font-medium">{pointCoords[hoveredIndex].value} WPM</div>
              <div className="text-muted-foreground">{pointCoords[hoveredIndex].time}</div>
            </div>
          )}
          {/* X-axis labels */}
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            {timeLabels.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        <span className="font-medium">Vary your pace</span> to keep your audience engaged. <span className="font-medium">Practice sections</span> where your pace is flat.
      </p>
    </div>
  );
}

interface AnalyticsPanelProps {
  showHeader?: boolean;
  className?: string;
  conversationId?: Id<"conversations">;
}

export function AnalyticsPanel({
  showHeader = true,
  className,
  conversationId,
}: AnalyticsPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  // Audio playback context for syncing with transcript
  const audioPlayback = useAudioPlaybackOptional();

  // Get current user
  const currentUser = useQuery(api.users.getCurrentUser);

  // Get analytics for this conversation
  const conversationAnalytics = useQuery(
    api.analytics.getConversationAnalytics,
    conversationId ? { conversationId } : "skip"
  );

  // Get transcript for word-level timestamps
  const transcript = useQuery(
    api.conversations.getTranscript,
    conversationId ? { conversationId } : "skip"
  );

  // Filter to current user's analytics
  const currentUserAnalytics =
    conversationAnalytics?.filter(
      (analytics) => currentUser && analytics.userId === currentUser._id
    ) || [];

  const analytics = currentUserAnalytics[0];

  // Build mapping of words to their timestamps for the current user
  const wordTimestampMap = useMemo(() => {
    const map = new Map<number, { word: string; startTime: number; wordId: string }>();
    if (!transcript || !currentUser) return map;
    
    let wordIndex = 0;
    transcript.forEach((turn) => {
      if (turn.userId === currentUser._id && turn.words) {
        turn.words.forEach((word) => {
          map.set(wordIndex, {
            word: word.word,
            startTime: word.startTime,
            wordId: word.wordId,
          });
          wordIndex++;
        });
      }
    });
    return map;
  }, [transcript, currentUser]);

  // Handle seeking to a timestamp
  const handleSeekToTime = (time: number, wordId?: string) => {
    if (audioPlayback) {
      if (wordId) {
        // Set highlighted word ID - this will trigger the TranscriptPlayer to seek and highlight
        audioPlayback.setHighlightedWordId(wordId);
      } else {
        audioPlayback.seekTo(time, true);
      }
    }
  };

  const analyzeUserSpeech = useMutation(api.analytics.analyzeUserSpeech);
  const generateSuggestions = useAction(api.analytics.generateWeakWordSuggestions);

  // Auto-analyze if no analytics exist
  useEffect(() => {
    const runAnalysis = async () => {
      if (
        conversationId &&
        currentUser &&
        currentUserAnalytics.length === 0 &&
        !isAnalyzing &&
        conversationAnalytics !== undefined
      ) {
        setIsAnalyzing(true);
        try {
          await analyzeUserSpeech({
            conversationId,
            userId: currentUser._id,
          });
        } catch (error) {
          console.error("Error analyzing speech:", error);
        } finally {
          setIsAnalyzing(false);
        }
      }
    };

    runAnalysis();
  }, [conversationId, currentUser?._id, currentUserAnalytics.length, conversationAnalytics, analyzeUserSpeech]);

  const handleGenerateSuggestions = async () => {
    if (!conversationId || !currentUser) return;

    setIsGeneratingSuggestions(true);
    try {
      await generateSuggestions({
        conversationId,
        userId: currentUser._id,
      });
    } catch (error) {
      console.error("Error generating suggestions:", error);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-green-500/10 border-green-500/20";
    if (score >= 60) return "bg-yellow-500/10 border-yellow-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  const getTrendIcon = (score: number) => {
    if (score >= 80) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (score >= 60) return <Minus className="w-4 h-4 text-yellow-500" />;
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  };

  // Loading state
  if (!conversationId) {
    return (
      <div className={`flex flex-col h-full min-h-0 ${className ?? ""}`}>
        {showHeader && (
          <h2 className="text-lg font-semibold text-foreground mb-4 shrink-0">Analytics</h2>
        )}
        <p className="text-sm text-muted-foreground text-center py-8">
          No conversation selected
        </p>
      </div>
    );
  }

  if (conversationAnalytics === undefined || isAnalyzing) {
    return (
      <div className={`flex flex-col h-full min-h-0 ${className ?? ""}`}>
        {showHeader && (
          <h2 className="text-lg font-semibold text-foreground mb-4 shrink-0">Analytics</h2>
        )}
        <div className="flex flex-col items-center justify-center py-8 space-y-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">
            {isAnalyzing ? "Analyzing your speech..." : "Loading analytics..."}
          </p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className={`flex flex-col h-full min-h-0 ${className ?? ""}`}>
        {showHeader && (
          <h2 className="text-lg font-semibold text-foreground mb-4 shrink-0">Analytics</h2>
        )}
        <p className="text-sm text-muted-foreground text-center py-8">
          No analytics available for this conversation
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full min-h-0 ${className ?? ""}`}>
      {showHeader && (
        <h2 className="text-lg font-semibold text-foreground mb-4 shrink-0">Analytics</h2>
      )}

      <Tabs defaultValue="overview" className="flex flex-col h-full min-h-0">
        <TabsList className="shrink-0 mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="word-choice">Word Choice</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
        </TabsList>

        {/* Overview Tab - AI Feedback */}
        <TabsContent value="overview" className="flex-1 min-h-0 overflow-hidden">
          <div className="space-y-4 overflow-auto h-full pr-3 custom-scrollbar">
            {currentUser && (
              <PersonalizedFeedback 
                conversationId={conversationId} 
                userId={currentUser._id} 
              />
            )}
          </div>
        </TabsContent>

        {/* Word Choice Tab */}
        <TabsContent value="word-choice" className="flex-1 min-h-0 overflow-hidden">
          <div className="space-y-4 overflow-auto h-full pr-3 custom-scrollbar">
            {/* Repetition - shown if count is low (good) */}
            <div className="space-y-2">
                <details className="group bg-muted/30 rounded-lg">
                  <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
                      <span className="text-sm text-foreground">Repetition</span>
                    </div>
                    <span className="text-sm text-primary">
                      {analytics.repetitions.repeatedWords.reduce((sum, w) => sum + w.count, 0)} repetition(s), {Math.round((analytics.repetitions.repeatedWords.reduce((sum, w) => sum + w.count, 0) / (analytics.pacing.wordsPerMinute * (analytics.pacing.wordsPerMinute > 0 ? 1 : 1))) * 100) || 0}%
                    </span>
                  </summary>
                  <div className="px-3 pb-3 pt-1">
                    {analytics.repetitions.repeatedWords.length > 0 ? (
                      <div className="space-y-2">
                        {analytics.repetitions.repeatedWords.slice(0, 5).map((item) => {
                          // Find first occurrence in transcript
                          const wordData = Array.from(wordTimestampMap.values()).find(
                            (w) => w.word.toLowerCase().replace(/[.,!?;:]/g, "") === item.word.toLowerCase()
                          );
                          
                          return (
                            <div key={item.word} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground capitalize">{item.word}</span>
                                {wordData && (
                                  <button
                                    onClick={() => handleSeekToTime(wordData.startTime, wordData.wordId)}
                                    className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[10px] font-mono bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors cursor-pointer"
                                    title={`Jump to first occurrence at ${formatTimestamp(wordData.startTime)}`}
                                  >
                                    <Play className="w-2 h-2" fill="currentColor" />
                                    {formatTimestamp(wordData.startTime)}
                                  </button>
                                )}
                              </div>
                              <span className="font-medium text-foreground">{item.count}x</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No excessive repetitions detected</p>
                    )}
                  </div>
                </details>

                {/* Filler Words */}
                <details className="group bg-muted/30 rounded-lg">
                  <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
                      <span className="text-sm text-foreground">Filler Words</span>
                    </div>
                    <span className="text-sm text-primary">
                      {analytics.fillerWords.count} filler(s), {Math.round(analytics.fillerWords.ratePerMinute)}%
                    </span>
                  </summary>
                  <div className="px-3 pb-3 pt-1">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Per Minute</span>
                        <span className="font-medium text-foreground">
                          {analytics.fillerWords.ratePerMinute.toFixed(1)}
                        </span>
                      </div>
                      {analytics.fillerWords.instances.length > 0 && (
                        <div className="pt-2 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2">Instances (click to jump):</p>
                          <div className="flex flex-wrap gap-1.5">
                            {analytics.fillerWords.instances.slice(0, 8).map((instance, idx) => {
                              const wordData = wordTimestampMap.get(instance.position);
                              if (wordData) {
                                return (
                                  <button
                                    key={`${instance.word}-${idx}`}
                                    onClick={() => handleSeekToTime(wordData.startTime, wordData.wordId)}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 rounded-md border border-yellow-500/20 transition-colors cursor-pointer"
                                    title={`Jump to "${instance.word}" at ${formatTimestamp(wordData.startTime)}`}
                                  >
                                    <Play className="w-2.5 h-2.5" fill="currentColor" />
                                    <span className="font-medium">{instance.word}</span>
                                    <span className="text-yellow-600/70 dark:text-yellow-500/70 font-mono text-[10px]">
                                      {formatTimestamp(wordData.startTime)}
                                    </span>
                                  </button>
                                );
                              }
                              return (
                                <span
                                  key={`${instance.word}-${idx}`}
                                  className="px-2 py-1 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-md text-xs border border-yellow-500/20"
                                >
                                  {instance.word}
                                </span>
                              );
                            })}
                            {analytics.fillerWords.instances.length > 8 && (
                              <span className="text-xs text-muted-foreground self-center">
                                +{analytics.fillerWords.instances.length - 8} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </details>

                {/* Weak Words */}
                {analytics.weakWords.length > 0 && (
                  <details className="group bg-muted/30 rounded-lg">
                    <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
                        <span className="text-sm text-foreground">Weak Words</span>
                      </div>
                      <span className="text-sm text-primary">
                        {analytics.weakWords.length} weak words
                      </span>
                    </summary>
                    <div className="px-3 pb-3 pt-1">
                      <div className="space-y-3">
                        {analytics.weakWords.slice(0, 3).map((item, index) => {
                          // Find this weak word in the transcript to get its timestamp
                          const wordData = Array.from(wordTimestampMap.values()).find(
                            (w) => w.word.toLowerCase().replace(/[.,!?;:]/g, "") === item.word.toLowerCase()
                          );
                          
                          return (
                            <div key={index} className="p-2 bg-background/50 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-muted-foreground">
                                  Weak word:{" "}
                                  <span className="font-medium text-foreground">"{item.word}"</span>
                                </p>
                                {wordData && (
                                  <button
                                    onClick={() => handleSeekToTime(wordData.startTime, wordData.wordId)}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded transition-colors cursor-pointer"
                                    title={`Jump to ${formatTimestamp(wordData.startTime)}`}
                                  >
                                    <Play className="w-2 h-2" fill="currentColor" />
                                    {formatTimestamp(wordData.startTime)}
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-foreground/80 italic">"{item.sentence}"</p>
                              {item.suggestion && (
                                <p className="text-xs text-primary font-medium mt-2">
                                  → "{item.suggestion}"
                                </p>
                              )}
                            </div>
                          );
                        })}
                        {analytics.weakWords.some((w) => !w.suggestion) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleGenerateSuggestions}
                            disabled={isGeneratingSuggestions}
                            className="h-7 text-xs w-full">
                            {isGeneratingSuggestions ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : (
                              <Sparkles className="w-3 h-3 mr-1" />
                            )}
                            Generate AI Suggestions
                          </Button>
                        )}
                      </div>
                    </div>
                  </details>
                )}

                {/* Conciseness */}
                <details className="group bg-muted/30 rounded-lg">
                  <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
                      <span className="text-sm text-foreground">Conciseness</span>
                    </div>
                    <span className="text-sm text-primary">
                      {100 - analytics.scores.conciseness}% Excess
                    </span>
                  </summary>
                  <div className="px-3 pb-3 pt-1">
                    <div className={`p-3 rounded-xl border ${getScoreBgColor(analytics.scores.conciseness)}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Score</span>
                        {getTrendIcon(analytics.scores.conciseness)}
                      </div>
                      <div className={`text-2xl font-bold ${getScoreColor(analytics.scores.conciseness)}`}>
                        {analytics.scores.conciseness}
                      </div>
                    </div>
                  </div>
                </details>

                {/* Sentence Starters */}
                {analytics.sentenceStarters.weak.length > 0 && (
                  <details className="group bg-muted/30 rounded-lg">
                    <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
                        <span className="text-sm text-foreground">Sentence Starters</span>
                      </div>
                      <span className="text-sm text-primary">
                        "{analytics.sentenceStarters.weak[0]?.word}," {Math.round((analytics.sentenceStarters.weak[0]?.count || 0) / analytics.sentenceStarters.weak.reduce((sum, s) => sum + s.count, 1) * 100)}%
                      </span>
                    </summary>
                    <div className="px-3 pb-3 pt-1">
                      <div className="space-y-2">
                        {analytics.sentenceStarters.weak.slice(0, 5).map((item) => {
                          // Find first occurrence of this starter word
                          const wordData = Array.from(wordTimestampMap.values()).find(
                            (w) => w.word.toLowerCase().replace(/[.,!?;:]/g, "") === item.word.toLowerCase()
                          );
                          
                          return (
                            <div key={item.word} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">"{item.word}"</span>
                                {wordData && (
                                  <button
                                    onClick={() => handleSeekToTime(wordData.startTime, wordData.wordId)}
                                    className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[10px] font-mono bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded transition-colors cursor-pointer"
                                    title={`Jump to first occurrence at ${formatTimestamp(wordData.startTime)}`}
                                  >
                                    <Play className="w-2 h-2" fill="currentColor" />
                                    {formatTimestamp(wordData.startTime)}
                                  </button>
                                )}
                              </div>
                              <span className="font-medium text-foreground">{item.count}x</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </details>
                )}
              </div>
          </div>
        </TabsContent>

        {/* Delivery Tab */}
        <TabsContent value="delivery" className="flex-1 min-h-0 overflow-hidden">
          <div className="space-y-4 overflow-auto h-full pr-3 custom-scrollbar">
            <div className="space-y-2">
              {/* Eye Contact - Placeholder (not available) */}
                <details className="group bg-muted/30 rounded-lg opacity-50">
                  <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
                      <span className="text-sm text-foreground">Eye Contact</span>
                    </div>
                    <span className="text-sm text-muted-foreground">N/A</span>
                  </summary>
                  <div className="px-3 pb-3 pt-1">
                    <p className="text-xs text-muted-foreground">Eye contact analysis requires video input</p>
                  </div>
                </details>

                {/* Pauses - Placeholder (not available) */}
                <details className="group bg-muted/30 rounded-lg opacity-50">
                  <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
                      <span className="text-sm text-foreground">Pauses</span>
                    </div>
                    <span className="text-sm text-muted-foreground">N/A</span>
                  </summary>
                  <div className="px-3 pb-3 pt-1">
                    <p className="text-xs text-muted-foreground">Pause analysis coming soon</p>
                  </div>
                </details>

                {/* Pacing */}
                <details className="group bg-muted/30 rounded-lg" open>
                  <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
                      <span className="text-sm text-foreground">Pacing</span>
                    </div>
                    <span className="text-sm text-primary">
                      {analytics.pacing.wordsPerMinute} words/minute
                    </span>
                  </summary>
                  <div className="px-3 pb-3 pt-1">
                    {/* Pacing feedback message */}
                    <div className="text-center mb-2">
                      <p className="text-sm text-muted-foreground">
                        {analytics.pacing.wordsPerMinute < 100
                          ? "Your pace was slow. Try speaking faster than 120 WPM."
                          : analytics.pacing.wordsPerMinute > 160
                            ? "Your pace was fast. Try slowing down to under 160 WPM."
                            : "Great pace! Keep it between 100-160 WPM for clarity."}
                      </p>
                    </div>

                    {/* Pacing Gauge */}
                    <PacingGauge wpm={analytics.pacing.wordsPerMinute} />

                    {/* Pacing Variation Chart */}
                    <PacingVariationChart
                      wpm={analytics.pacing.wordsPerMinute}
                      segments={analytics.pacing.segments}
                      durationSeconds={analytics.pacing.durationSeconds}
                    />
                  </div>
                </details>
              </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
