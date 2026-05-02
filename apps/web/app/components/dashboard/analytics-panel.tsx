import { api } from "@audora/backend/convex/_generated/api";
import type { Id } from "@audora/backend/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import {
    ChevronLeft,
    ChevronRight,
    Loader2,
    Minus,
    Play,
    Sparkles,
    TrendingDown,
    TrendingUp
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PersonalizedFeedback } from "~/components/analytics/PersonalizedFeedback";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useAudioPlaybackOptional } from "~/hooks/use-audio-playback";
import { formatConversationDuration, getConversationDurationMs } from "~/lib/conversation-duration";

// Format seconds to MM:SS
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function getWeakWordSnippet(sentence: string, word: string, maxLength = 96): string {
  const normalizedSentence = sentence.trim().replace(/\s+/g, " ");
  if (normalizedSentence.length <= maxLength) return normalizedSentence;

  const wordIndex = normalizedSentence.toLowerCase().indexOf(word.toLowerCase());
  if (wordIndex === -1) {
    return `${normalizedSentence.slice(0, maxLength - 3).trimEnd()}...`;
  }

  const targetStart = Math.max(0, wordIndex - Math.floor((maxLength - word.length) / 2));
  const targetEnd = Math.min(normalizedSentence.length, targetStart + maxLength);
  const start = Math.max(0, targetEnd - maxLength);
  const prefix = start > 0 ? "..." : "";
  const suffix = targetEnd < normalizedSentence.length ? "..." : "";
  const availableLength = maxLength - prefix.length - suffix.length;
  const snippet = normalizedSentence.slice(start, start + availableLength).trim();

  return `${prefix}${snippet}${suffix}`;
}

const WEAK_WORD_REPLACEMENT_LABELS: Record<string, string> = {
  thing: "a specific noun",
  stuff: "specific details",
  just: "remove it",
  really: "a stronger adjective",
  very: "a stronger adjective",
  quite: "a precise qualifier",
  pretty: "a precise qualifier",
  "kind of": "a direct phrase",
  "sort of": "a direct phrase",
  "a bit": "slightly, or a specific amount",
  maybe: "a clear recommendation",
  probably: "likely, with evidence",
};

function normalizeSpeechToken(token: string): string {
  return token.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getFallbackWeakWordReplacement(word: string): string {
  return WEAK_WORD_REPLACEMENT_LABELS[word.toLowerCase()] ?? "a more specific word";
}

function cleanWeakWordSuggestion(suggestion?: string): string | null {
  if (!suggestion) return null;

  const cleaned = suggestion
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/^(try|rewrite|suggestion):\s*/i, "")
    .trim();

  if (!cleaned || cleaned.length > 220) return null;

  const sentenceCount = cleaned.split(/[.!?]+/).filter((part) => part.trim().length > 0).length;
  if (sentenceCount > 2 && cleaned.length > 120) return null;

  return cleaned;
}

function getWeakWordRecommendation(word: string, replacement?: string, suggestion?: string) {
  return {
    replacement: replacement?.trim() || getFallbackWeakWordReplacement(word),
    rewrite: cleanWeakWordSuggestion(suggestion),
  };
}

function splitWeakWordContext(sentence: string, word: string): Array<{ text: string; isWeak: boolean }> {
  const pattern = escapeRegExp(word.trim()).replace(/\s+/g, "\\s+");
  const match = sentence.match(new RegExp(`\\b${pattern}\\b`, "i"));

  if (!match || match.index === undefined) {
    return [{ text: sentence, isWeak: false }];
  }

  const start = match.index;
  const end = start + match[0].length;
  return [
    { text: sentence.slice(0, start), isWeak: false },
    { text: sentence.slice(start, end), isWeak: true },
    { text: sentence.slice(end), isWeak: false },
  ].filter((part) => part.text.length > 0);
}

function WeakWordContext({ sentence, word }: { sentence: string; word: string }) {
  return (
    <p className="mt-1 text-xs italic leading-5 text-foreground/80">
      "
      {splitWeakWordContext(sentence, word).map((part, index) =>
        part.isWeak ? (
          <mark
            key={`${part.text}-${index}`}
            className="rounded-sm bg-orange-500/15 px-0.5 font-semibold text-orange-700 dark:text-orange-300"
          >
            {part.text}
          </mark>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        )
      )}
      "
    </p>
  );
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatPercent(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(fractionDigits)}%`;
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function getScoreLabel(score: number): string {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Solid";
  if (score >= 55) return "Needs attention";
  return "High priority";
}

function getPaceLabel(wpm: number): string {
  if (wpm < 100) return "Slow";
  if (wpm > 160) return "Fast";
  return "Conversational";
}

function getPaceTarget(wpm: number): string {
  if (wpm < 100) return "Aim for 100-160 WPM when the point does not need extra emphasis.";
  if (wpm > 160) return "Slow down toward 100-160 WPM so listeners can keep up.";
  return "This sits inside the target range for clear conversational pacing.";
}

function countBy<T extends string>(items: T[]): Array<{ item: T; count: number }> {
  const counts = new Map<T, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([item, count]) => ({ item, count }))
    .sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));
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
  const hoveredPoint = hoveredIndex !== null ? pointCoords[hoveredIndex] : null;
  const hoveredXPercent = hoveredPoint ? (hoveredPoint.x / width) * 100 : 0;
  const hoveredYPercent = hoveredPoint ? (hoveredPoint.y / height) * 100 : 0;
  const tooltipLeft =
    hoveredXPercent < 12
      ? "0.5rem"
      : hoveredXPercent > 88
        ? "calc(100% - 0.5rem)"
        : `${hoveredXPercent}%`;
  const tooltipXTransform =
    hoveredXPercent < 12
      ? "translateX(0)"
      : hoveredXPercent > 88
        ? "translateX(-100%)"
        : "translateX(-50%)";

  return (
    <div className="mt-2">
      <div className="relative p-2">
        <div className="flex items-start">
          {/* Y-axis labels */}
          <div className="flex-shrink-0 pb-4">
            <div className="relative h-16 w-12 text-[10px] text-muted-foreground">
              <span className="absolute right-3 text-primary/70" style={{ top: `${y160Percent}%`, transform: "translateY(-50%)" }}>160</span>
              <span className="absolute right-3 text-primary/70" style={{ top: `${y100Percent}%`, transform: "translateY(-50%)" }}>100</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="min-w-full pb-0.5 sm:min-w-[560px]">
              {/* Chart area */}
              <div className="relative h-16 overflow-hidden">
                <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full" preserveAspectRatio="none">
                  <defs>
                    <clipPath id="pacing-chart-clip">
                      <rect x="0" y="0" width={width} height={height} />
                    </clipPath>
                  </defs>
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
                    clipPath="url(#pacing-chart-clip)"
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
                      clipPath="url(#pacing-chart-clip)"
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
                      clipPath="url(#pacing-chart-clip)"
                      vectorEffect="non-scaling-stroke"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </svg>
                {/* Tooltip */}
                {hoveredIndex !== null && (
                  <div
                    className="absolute z-10 rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md pointer-events-none"
                    style={{
                      left: tooltipLeft,
                      top: `clamp(0.25rem, ${hoveredYPercent}%, calc(100% - 2.75rem))`,
                      transform: tooltipXTransform
                    }}
                  >
                    <div className="font-medium">{pointCoords[hoveredIndex].value} WPM</div>
                    <div className="text-muted-foreground">{pointCoords[hoveredIndex].time}</div>
                  </div>
                )}
              </div>
              {/* X-axis labels */}
              <div className="mt-1 grid grid-flow-col auto-cols-fr px-1 text-[10px] leading-none text-muted-foreground">
                {timeLabels.map((label, i) => (
                  <span
                    key={i}
                    className={i === 0 ? "text-left" : i === timeLabels.length - 1 ? "text-right" : "text-center"}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AnalyticsPanelProps {
  showHeader?: boolean;
  className?: string;
  conversationId?: Id<"conversations">;
  onOpenTranscript?: () => void;
}

export function AnalyticsPanel({
  showHeader = true,
  className,
  conversationId,
  onOpenTranscript,
}: AnalyticsPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [weakWordExampleIndex, setWeakWordExampleIndex] = useState(0);

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

  const conversation = useQuery(
    api.conversations.get,
    conversationId ? { id: conversationId } : "skip"
  );

  // Filter to current user's analytics
  const currentUserAnalytics =
    conversationAnalytics?.filter(
      (analytics) => currentUser && analytics.userId === currentUser._id
    ) || [];

  const analytics = currentUserAnalytics[0];

  const isCurrentUserTranscriptTurn = useMemo(() => {
    return (turn: NonNullable<typeof transcript>[number]) => {
      if (!currentUser) return false;
      if (turn.userId === currentUser._id) return true;

      if (!turn.userId && conversation) {
        if (turn.speaker === "S1" && conversation.initiatorUserId === currentUser._id) return true;
        if (turn.speaker === "S2" && conversation.scannerUserId === currentUser._id) return true;
      }

      return false;
    };
  }, [conversation, currentUser]);

  // Build mapping of words to their timestamps for the current user
  const wordTimestampMap = useMemo(() => {
    const map = new Map<number, { word: string; startTime: number; wordId: string }>();
    if (!transcript || !currentUser) return map;
    
    let wordIndex = 0;
    transcript.forEach((turn) => {
      if (isCurrentUserTranscriptTurn(turn) && turn.words) {
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
  }, [transcript, currentUser, isCurrentUserTranscriptTurn]);

  // Handle seeking to a timestamp
  const handleSeekToTime = (time: number, wordId?: string) => {
    onOpenTranscript?.();

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

  const repeatedWordCount = analytics?.repetitions.repeatedWords.reduce(
    (sum, word) => sum + word.count,
    0
  ) ?? 0;

  const sentenceStarterTotal = analytics?.sentenceStarters.weak.reduce(
    (sum, starter) => sum + starter.count,
    0
  ) ?? 0;

  const topSentenceStarter = analytics?.sentenceStarters.weak[0];

  const currentUserTurns = useMemo(() => {
    if (!transcript) return [];
    return transcript.filter(isCurrentUserTranscriptTurn);
  }, [transcript, isCurrentUserTranscriptTurn]);

  const currentUserWordCount = useMemo(
    () => currentUserTurns.reduce((sum, turn) => sum + countWords(turn.text), 0),
    [currentUserTurns]
  );

  const totalTranscriptWordCount = useMemo(
    () => transcript?.reduce((sum, turn) => sum + countWords(turn.text), 0) ?? 0,
    [transcript]
  );

  const conversationDurationMs = getConversationDurationMs(conversation, transcript);
  const speakingMinutes =
    analytics && analytics.pacing.wordsPerMinute > 0
      ? currentUserWordCount / analytics.pacing.wordsPerMinute
      : 0;
  const speakingTimeLabel =
    speakingMinutes > 0
      ? formatConversationDuration(Math.round(speakingMinutes * 60000))
      : "N/A";
  const conversationShare =
    totalTranscriptWordCount > 0 ? (currentUserWordCount / totalTranscriptWordCount) * 100 : 0;
  const averageWordsPerTurn =
    currentUserTurns.length > 0 ? currentUserWordCount / currentUserTurns.length : 0;

  const scoreCards = analytics
    ? [
        {
          label: "Clarity",
          score: analytics.scores.clarity,
          detail: `${analytics.fillerWords.count} filler ${
            analytics.fillerWords.count === 1 ? "word" : "words"
          } detected`,
        },
        {
          label: "Conciseness",
          score: analytics.scores.conciseness,
          detail: `${repeatedWordCount} repeated word ${
            repeatedWordCount === 1 ? "instance" : "instances"
          }`,
        },
        {
          label: "Confidence",
          score: analytics.scores.confidence,
          detail: `${sentenceStarterTotal} weak sentence ${
            sentenceStarterTotal === 1 ? "starter" : "starters"
          }`,
        },
      ]
    : [];

  const overallScore =
    analytics
      ? Math.round(
          (analytics.scores.clarity +
            analytics.scores.conciseness +
            analytics.scores.confidence) /
            3
        )
      : 0;

  const fillerBreakdown = analytics
    ? countBy(analytics.fillerWords.instances.map((instance) => instance.word)).slice(0, 6)
    : [];
  const weakWordBreakdown = analytics
    ? countBy(analytics.weakWords.map((item) => item.word)).slice(0, 6)
    : [];
  const weakWordsNeedSuggestions =
    analytics?.weakWords.some((word) => !cleanWeakWordSuggestion(word.suggestion)) ?? false;
  const repeatedPhraseCount =
    analytics?.repetitions.repeatedPhrases.reduce((sum, phrase) => sum + phrase.count, 0) ?? 0;
  const weakStarterRate =
    analytics && analytics.sentenceStarters.total > 0
      ? (sentenceStarterTotal / analytics.sentenceStarters.total) * 100
      : 0;
  const fillerPer100Words =
    currentUserWordCount > 0 && analytics
      ? (analytics.fillerWords.count / currentUserWordCount) * 100
      : 0;
  const hasConversationSummary = Boolean(conversation?.summary?.trim());

  const weakWordExamples = analytics?.weakWords || [];
  const selectedWeakWordExample =
    weakWordExamples.length > 0
      ? weakWordExamples[weakWordExampleIndex % weakWordExamples.length]
      : null;
  const getWeakWordLocation = (item: NonNullable<typeof selectedWeakWordExample>) => {
    if (typeof item.position === "number") {
      const wordData = wordTimestampMap.get(item.position);
      if (wordData) return wordData;
    }

    if (typeof item.startTime === "number") {
      return {
        word: item.word,
        startTime: item.startTime,
        wordId: undefined,
      };
    }

    return Array.from(wordTimestampMap.values()).find(
      (wordData) => normalizeSpeechToken(wordData.word) === item.word.toLowerCase()
    ) ?? null;
  };
  const selectedWeakWordLocation = selectedWeakWordExample
    ? getWeakWordLocation(selectedWeakWordExample)
    : null;
  const selectedWeakWordRecommendation = selectedWeakWordExample
    ? getWeakWordRecommendation(
        selectedWeakWordExample.word,
        selectedWeakWordExample.replacement,
        selectedWeakWordExample.suggestion
      )
    : null;

  useEffect(() => {
    if (weakWordExampleIndex >= weakWordExamples.length) {
      setWeakWordExampleIndex(0);
    }
  }, [weakWordExampleIndex, weakWordExamples.length]);

  const actionableInsightsContent = currentUser && conversationId ? (
    <PersonalizedFeedback
      conversationId={conversationId}
      userId={currentUser._id}
    />
  ) : (
    <p className="text-sm text-muted-foreground">Sign in to view personalized insights.</p>
  );

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

      <Tabs defaultValue="summary" className="flex flex-col h-full min-h-0">
        <TabsList className="hidden">
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="word-choice">Word Choice</TabsTrigger>
          <TabsTrigger value="overview">Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="flex-1 min-h-0 overflow-hidden">
          <div className="grid h-full min-h-0 gap-5 overflow-hidden xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid min-h-0 min-w-0 auto-rows-min items-start gap-5 overflow-y-auto pr-1 custom-scrollbar md:grid-cols-2 xl:grid-cols-6">
              <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm xl:col-span-6">
                <div className="grid gap-4 border-b border-border/70 pb-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Conversation Summary
                    </p>
                    <h3 className="mt-1 text-lg font-semibold leading-tight text-foreground">
                      {hasConversationSummary ? "What this conversation covered" : "Transcript-based context"}
                    </h3>
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-2 text-xs text-muted-foreground lg:justify-end">
                    <span className="whitespace-nowrap rounded-md border border-border bg-background px-2 py-1">
                      {formatConversationDuration(conversationDurationMs)}
                    </span>
                    <span className="whitespace-nowrap rounded-md border border-border bg-background px-2 py-1">
                      {formatCompactNumber(totalTranscriptWordCount)} total words
                    </span>
                  </div>
                </div>
                <p className="mt-4 max-h-36 overflow-y-auto pr-2 text-sm leading-7 text-muted-foreground custom-scrollbar">
                  {conversation === undefined
                    ? "Loading conversation summary..."
                    : hasConversationSummary
                    ? conversation?.summary
                    : "No AI-generated conversation summary has been saved yet. The rest of this screen uses transcript analytics and coaching feedback that are available for this conversation."}
                </p>
              </section>

              <section className="flex min-h-[11rem] min-w-0 flex-col rounded-xl border border-border bg-card p-5 shadow-sm xl:col-span-2">
                <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border/70 pb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Overall Score
                  </p>
                  <span className={`text-xs font-medium ${getScoreColor(overallScore)}`}>
                    {getScoreLabel(overallScore)}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-end gap-x-2 gap-y-1">
                  <p className={`text-4xl font-semibold leading-none ${getScoreColor(overallScore)}`}>
                    {overallScore}
                  </p>
                  <p className="pb-1 text-sm leading-none text-muted-foreground">/100 average</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Average of clarity, conciseness, and confidence for your speech in this conversation.
                </p>
              </section>

              {scoreCards.map((scoreCard) => (
                <section
                  key={scoreCard.label}
                  className={`flex min-h-[11rem] min-w-0 flex-col rounded-xl border p-5 shadow-sm xl:col-span-1 ${getScoreBgColor(scoreCard.score)}`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <p className="min-w-0 break-words text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {scoreCard.label}
                    </p>
                    <span className="shrink-0">{getTrendIcon(scoreCard.score)}</span>
                  </div>
                  <p className={`mt-4 text-3xl font-semibold leading-none ${getScoreColor(scoreCard.score)}`}>
                    {scoreCard.score}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    {scoreCard.detail}
                  </p>
                </section>
              ))}

              <section className="flex min-h-[11rem] min-w-0 flex-col rounded-xl border border-border bg-card p-5 shadow-sm xl:col-span-1">
                <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border/70 pb-3">
                  <p className="min-w-0 break-words text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Speaking Share
                  </p>
                  <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                    {currentUserTurns.length} turns
                  </span>
                </div>
                <p className="mt-4 text-3xl font-semibold leading-none text-foreground">
                  {formatPercent(conversationShare)}
                </p>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {formatCompactNumber(currentUserWordCount)} words from you, about{" "}
                  {formatCompactNumber(averageWordsPerTurn)} words per turn, over {speakingTimeLabel} speaking time.
                </p>
              </section>

              <section className="flex min-h-[15rem] min-w-0 flex-col rounded-xl border border-border bg-card p-5 shadow-sm xl:col-span-3">
                <div className="grid gap-3 border-b border-border/70 pb-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pace of Speech
                    </p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium normal-case tracking-normal text-muted-foreground">
                      <span className="h-2 w-3 rounded-sm bg-primary/20" />
                      Conversational (100-160)
                    </span>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <span className="block text-sm font-semibold text-foreground">
                      {analytics.pacing.wordsPerMinute}
                      <span className="ml-1 font-normal text-muted-foreground">words/min</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {getPaceLabel(analytics.pacing.wordsPerMinute)}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{getPaceTarget(analytics.pacing.wordsPerMinute)}</p>
                <PacingVariationChart
                  wpm={analytics.pacing.wordsPerMinute}
                  segments={analytics.pacing.segments}
                  durationSeconds={analytics.pacing.durationSeconds}
                />
              </section>

              <section className="flex min-h-[15rem] min-w-0 flex-col rounded-xl border border-border bg-card p-5 shadow-sm xl:col-span-3">
                <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border/70 pb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Filler Words
                  </p>
                  <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                    {analytics.fillerWords.count} total
                  </span>
                </div>
                <p className="mt-4 text-3xl font-semibold leading-none text-foreground">
                  {analytics.fillerWords.ratePerMinute.toFixed(1)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">words/min</span>
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {analytics.fillerWords.count > 0
                    ? `${formatPercent(fillerPer100Words, 1)} of your words were fillers.`
                    : "No filler words detected in your analyzed speech."}
                </p>
                {fillerBreakdown.length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {fillerBreakdown.slice(0, 4).map((item) => (
                      <div key={item.item} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs">
                        <span className="font-medium text-foreground">"{item.item}"</span>
                        <span className="text-muted-foreground">{item.count}x</span>
                      </div>
                    ))}
                  </div>
                )}
                {analytics.fillerWords.instances.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {analytics.fillerWords.instances.slice(0, 6).map((instance, idx) => {
                      const wordData = wordTimestampMap.get(instance.position);
                      if (!wordData) {
                        return (
                          <span
                            key={`${instance.word}-${idx}`}
                            className="rounded-md border border-yellow-500/20 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-700 dark:text-yellow-400"
                          >
                            {instance.word}
                          </span>
                        );
                      }

                      return (
                        <button
                          key={`${instance.word}-${idx}`}
                          onClick={() => handleSeekToTime(wordData.startTime, wordData.wordId)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-yellow-500/20 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-700 transition-colors hover:bg-yellow-500/20 dark:text-yellow-400"
                          title={`Jump to "${instance.word}" at ${formatTimestamp(wordData.startTime)}`}
                        >
                          <Play className="h-2.5 w-2.5" fill="currentColor" />
                          {instance.word}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="flex min-h-[15rem] min-w-0 flex-col rounded-xl border border-border bg-card p-5 shadow-sm xl:col-span-2">
                <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border/70 pb-3">
                  <p className="min-w-0 break-words text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Repetition
                  </p>
                  <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                    {repeatedPhraseCount} phrase {repeatedPhraseCount === 1 ? "hit" : "hits"}
                  </span>
                </div>
                <p className="mt-4 text-3xl font-semibold leading-none text-foreground">
                  {repeatedWordCount}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">instances</span>
                </p>
                <div className="mt-4 space-y-2 pb-3">
                  {analytics.repetitions.repeatedWords.length > 0 ? (
                    analytics.repetitions.repeatedWords.slice(0, 4).map((item) => (
                      <div key={item.word} className="flex items-center justify-between text-sm">
                        <span className="capitalize text-muted-foreground">{item.word}</span>
                        <span className="font-medium text-foreground">{item.count}x</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No excessive repetitions detected.</p>
                  )}
                </div>
                {analytics.repetitions.repeatedPhrases.length > 0 && (
                  <div className="mt-auto border-t border-border/70 pt-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Repeated phrases</p>
                    <div className="space-y-1.5">
                      {analytics.repetitions.repeatedPhrases.slice(0, 3).map((item) => (
                        <div key={item.phrase} className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate text-muted-foreground">"{item.phrase}"</span>
                          <span className="shrink-0 font-medium text-foreground">{item.count}x</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="flex min-h-[15rem] min-w-0 flex-col rounded-xl border border-border bg-card p-5 shadow-sm xl:col-span-2">
                <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border/70 pb-3">
                  <p className="min-w-0 break-words text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Weak Words
                  </p>
                  <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">Word choice</span>
                </div>
                <p className="mt-4 text-3xl font-semibold leading-none text-foreground">
                  {analytics.weakWords.length}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">found</span>
                </p>
                {weakWordBreakdown.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {weakWordBreakdown.slice(0, 5).map((item) => (
                      <span
                        key={item.item}
                        className="rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-xs text-orange-700 dark:text-orange-400"
                      >
                        {item.item} {item.count > 1 ? `${item.count}x` : ""}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-4 pb-3">
                  {selectedWeakWordExample ? (
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              Weak word:{" "}
                              <span className="font-medium text-foreground">
                                "{selectedWeakWordExample.word}"
                              </span>
                            </span>
                            {selectedWeakWordLocation ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleSeekToTime(
                                    selectedWeakWordLocation.startTime,
                                    selectedWeakWordLocation.wordId
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-md bg-orange-500/10 px-1.5 py-0.5 font-mono text-[10px] text-orange-700 transition-colors hover:bg-orange-500/20 dark:text-orange-400"
                                title={`Jump to ${formatTimestamp(selectedWeakWordLocation.startTime)}`}
                              >
                                <Play className="h-2.5 w-2.5" fill="currentColor" />
                                {formatTimestamp(selectedWeakWordLocation.startTime)}
                              </button>
                            ) : typeof selectedWeakWordExample.position === "number" ? (
                              <span className="font-mono text-[10px]">
                                word {selectedWeakWordExample.position + 1}
                              </span>
                            ) : null}
                          </div>
                          <WeakWordContext
                            sentence={getWeakWordSnippet(
                              selectedWeakWordExample.sentence,
                              selectedWeakWordExample.word,
                              120
                            )}
                            word={selectedWeakWordExample.word}
                          />
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setWeakWordExampleIndex((index) =>
                                (index - 1 + weakWordExamples.length) % weakWordExamples.length
                              )
                            }
                            className="rounded-md border border-border bg-background p-1 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Previous weak word example"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setWeakWordExampleIndex((index) => (index + 1) % weakWordExamples.length)
                            }
                            className="rounded-md border border-border bg-background p-1 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Next weak word example"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        {weakWordExampleIndex + 1} of {weakWordExamples.length}
                      </p>
                      {selectedWeakWordRecommendation && (
                        <div className="mt-3 border-l-2 border-orange-500/50 pl-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Replace with
                          </p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {selectedWeakWordRecommendation.replacement}
                          </p>
                          {selectedWeakWordRecommendation.rewrite && (
                            <p className="mt-2 text-xs leading-5 text-primary">
                              Cleaner sentence: "{selectedWeakWordRecommendation.rewrite}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No weak words detected.</p>
                  )}
                </div>
                {weakWordsNeedSuggestions && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateSuggestions}
                    disabled={isGeneratingSuggestions}
                    className="mt-auto h-8 text-xs"
                  >
                    {isGeneratingSuggestions ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Generate suggestions
                  </Button>
                )}
              </section>

              <section className="flex min-h-[15rem] min-w-0 flex-col rounded-xl border border-border bg-card p-5 shadow-sm xl:col-span-2">
                <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border/70 pb-3">
                  <p className="min-w-0 break-words text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Sentence Starters
                  </p>
                  <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                    {analytics.sentenceStarters.total} sentences
                  </span>
                </div>
                <p className="mt-4 text-3xl font-semibold leading-none text-foreground">
                  {sentenceStarterTotal}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">uses</span>
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {topSentenceStarter
                    ? `"${topSentenceStarter.word}" showed up most often. ${formatPercent(weakStarterRate)} of starts were weak.`
                    : "No weak sentence starters detected."}
                </p>
                <div className="mt-4 space-y-2 pb-3">
                  {analytics.sentenceStarters.weak.slice(0, 4).map((item) => (
                    <div key={item.word} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">"{item.word}"</span>
                      <span className="font-medium text-foreground">{item.count}x</span>
                    </div>
                  ))}
                </div>
              </section>

            </div>

            <aside className="hidden h-full min-h-0 flex-col rounded-xl border border-border bg-sidebar p-5 shadow-sm dark:bg-card xl:flex">
              <div className="shrink-0 border-b border-border/70 pb-3">
                <h3 className="text-base font-semibold text-foreground">Actionable Insights</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Focus areas from this conversation.
                </p>
              </div>
              <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {actionableInsightsContent}
              </div>
            </aside>
          </div>
        </TabsContent>

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
                          const wordData = getWeakWordLocation(item);
                          const recommendation = getWeakWordRecommendation(
                            item.word,
                            item.replacement,
                            item.suggestion
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
                              <WeakWordContext
                                sentence={getWeakWordSnippet(item.sentence, item.word, 140)}
                                word={item.word}
                              />
                              <div className="mt-2 border-l-2 border-orange-500/50 pl-2">
                                <p className="text-[11px] text-muted-foreground">
                                  Replace with{" "}
                                  <span className="font-semibold text-foreground">
                                    {recommendation.replacement}
                                  </span>
                                </p>
                              </div>
                              {recommendation.rewrite && (
                                <p className="mt-2 text-xs font-medium leading-5 text-primary">
                                  Cleaner sentence: "{recommendation.rewrite}"
                                </p>
                              )}
                            </div>
                          );
                        })}
                        {weakWordsNeedSuggestions && (
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
