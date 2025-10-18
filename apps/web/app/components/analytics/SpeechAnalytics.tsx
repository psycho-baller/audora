import { TrendingUp, TrendingDown, Minus, MessageSquare, Timer, Repeat, AlertTriangle } from "lucide-react";

interface AnalyticsData {
  fillerWords: {
    count: number;
    ratePerMinute: number;
    instances: Array<{ word: string; position: number }>;
  };
  pacing: {
    wordsPerMinute: number;
    averagePauseDuration?: number;
    longestPause?: number;
  };
  repetitions: {
    repeatedWords: Array<{ word: string; count: number }>;
    repeatedPhrases: Array<{ phrase: string; count: number }>;
  };
  sentenceStarters: {
    total: number;
    weak: Array<{ word: string; count: number }>;
  };
  weakWords: Array<{
    word: string;
    sentence: string;
    suggestion?: string;
  }>;
  scores: {
    clarity: number;
    conciseness: number;
    confidence: number;
  };
}

interface SpeechAnalyticsProps {
  analytics: AnalyticsData;
  userName?: string;
}

export default function SpeechAnalytics({ analytics, userName }: SpeechAnalyticsProps) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Communication Analysis {userName && `- ${userName}`}
        </h3>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 rounded-xl border ${getScoreBgColor(analytics.scores.clarity)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Clarity</span>
            {getTrendIcon(analytics.scores.clarity)}
          </div>
          <div className={`text-3xl font-bold ${getScoreColor(analytics.scores.clarity)}`}>
            {analytics.scores.clarity}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Based on filler words</p>
        </div>

        <div className={`p-4 rounded-xl border ${getScoreBgColor(analytics.scores.conciseness)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Conciseness</span>
            {getTrendIcon(analytics.scores.conciseness)}
          </div>
          <div className={`text-3xl font-bold ${getScoreColor(analytics.scores.conciseness)}`}>
            {analytics.scores.conciseness}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Based on repetitions</p>
        </div>

        <div className={`p-4 rounded-xl border ${getScoreBgColor(analytics.scores.confidence)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Confidence</span>
            {getTrendIcon(analytics.scores.confidence)}
          </div>
          <div className={`text-3xl font-bold ${getScoreColor(analytics.scores.confidence)}`}>
            {analytics.scores.confidence}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Based on sentence starters</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Filler Words */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h4 className="font-semibold text-foreground">Filler Words</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Count</span>
              <span className="font-medium text-foreground">{analytics.fillerWords.count}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Per Minute</span>
              <span className="font-medium text-foreground">
                {analytics.fillerWords.ratePerMinute.toFixed(1)}
              </span>
            </div>
            {analytics.fillerWords.instances.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Most Common:</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(
                    new Set(analytics.fillerWords.instances.slice(0, 5).map((i) => i.word))
                  ).map((word) => (
                    <span
                      key={word}
                      className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pacing */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Timer className="w-5 h-5 text-primary" />
            <h4 className="font-semibold text-foreground">Pacing</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Words Per Minute</span>
              <span className="font-medium text-foreground">{analytics.pacing.wordsPerMinute}</span>
            </div>
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                {analytics.pacing.wordsPerMinute < 100
                  ? "Speaking slowly - good for clarity"
                  : analytics.pacing.wordsPerMinute > 160
                  ? "Speaking quickly - consider slowing down"
                  : "Good speaking pace"}
              </p>
            </div>
          </div>
        </div>

        {/* Repetitions */}
        {analytics.repetitions.repeatedWords.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Repeat className="w-5 h-5 text-primary" />
              <h4 className="font-semibold text-foreground">Repeated Words</h4>
            </div>
            <div className="space-y-2">
              {analytics.repetitions.repeatedWords.slice(0, 5).map((item) => (
                <div key={item.word} className="flex justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{item.word}</span>
                  <span className="font-medium text-foreground">{item.count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sentence Starters */}
        {analytics.sentenceStarters.weak.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <h4 className="font-semibold text-foreground">Weak Sentence Starters</h4>
            </div>
            <div className="space-y-2">
              {analytics.sentenceStarters.weak.slice(0, 5).map((item) => (
                <div key={item.word} className="flex justify-between text-sm">
                  <span className="text-muted-foreground capitalize">"{item.word}"</span>
                  <span className="font-medium text-foreground">{item.count}x</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                Try to vary your sentence starters for better flow
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Weak Words with Suggestions */}
      {analytics.weakWords.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h4 className="font-semibold text-foreground mb-3">Improvement Suggestions</h4>
          <div className="space-y-3">
            {analytics.weakWords.slice(0, 3).map((item, index) => (
              <div key={index} className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Weak word: <span className="font-medium text-foreground">"{item.word}"</span>
                    </p>
                  </div>
                </div>
                <p className="text-sm text-foreground/80 italic mb-2">"{item.sentence}"</p>
                {item.suggestion && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">Suggested:</p>
                    <p className="text-sm text-primary font-medium">"{item.suggestion}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
