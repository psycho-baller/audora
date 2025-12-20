import { api } from "@audora/backend/convex/_generated/api";
import type { Id } from "@audora/backend/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Loader2,
  MessageSquare,
  Minus,
  Repeat,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";

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

  // Get current user
  const currentUser = useQuery(api.users.getCurrentUser);

  // Get analytics for this conversation
  const conversationAnalytics = useQuery(
    api.analytics.getConversationAnalytics,
    conversationId ? { conversationId } : "skip"
  );

  // Filter to current user's analytics
  const currentUserAnalytics =
    conversationAnalytics?.filter(
      (analytics) => currentUser && analytics.userId === currentUser._id
    ) || [];

  const analytics = currentUserAnalytics[0];

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
  }, [conversationId, currentUser, currentUserAnalytics.length, isAnalyzing, conversationAnalytics]);

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

      <div className="space-y-6 overflow-auto flex-1 min-h-0 pr-3 custom-scrollbar">
        {/* Score Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div
            className={`p-3 rounded-xl border ${getScoreBgColor(analytics.scores.clarity)}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Clarity</span>
              {getTrendIcon(analytics.scores.clarity)}
            </div>
            <div
              className={`text-2xl font-bold ${getScoreColor(analytics.scores.clarity)}`}>
              {analytics.scores.clarity}
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border ${getScoreBgColor(analytics.scores.conciseness)}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Concise</span>
              {getTrendIcon(analytics.scores.conciseness)}
            </div>
            <div
              className={`text-2xl font-bold ${getScoreColor(analytics.scores.conciseness)}`}>
              {analytics.scores.conciseness}
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border ${getScoreBgColor(analytics.scores.confidence)}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Confidence</span>
              {getTrendIcon(analytics.scores.confidence)}
            </div>
            <div
              className={`text-2xl font-bold ${getScoreColor(analytics.scores.confidence)}`}>
              {analytics.scores.confidence}
            </div>
          </div>
        </div>

        {/* Filler Words */}
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h4 className="font-medium text-foreground text-sm">Filler Words</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Count</span>
              <span className="font-medium text-foreground">
                {analytics.fillerWords.count}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Per Minute</span>
              <span className="font-medium text-foreground">
                {analytics.fillerWords.ratePerMinute.toFixed(1)}
              </span>
            </div>
            {analytics.fillerWords.instances.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Most Common:</p>
                <div className="flex flex-wrap gap-1">
                  {Array.from(
                    new Set(
                      analytics.fillerWords.instances.slice(0, 5).map((i) => i.word)
                    )
                  ).map((word) => (
                    <span
                      key={word}
                      className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pacing */}
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Timer className="w-4 h-4 text-primary" />
            <h4 className="font-medium text-foreground text-sm">Pacing</h4>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Words Per Minute</span>
            <span className="font-medium text-foreground">
              {analytics.pacing.wordsPerMinute}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {analytics.pacing.wordsPerMinute < 100
              ? "Speaking slowly - good for clarity"
              : analytics.pacing.wordsPerMinute > 160
                ? "Speaking quickly - consider slowing down"
                : "Good speaking pace"}
          </p>
        </div>

        {/* Repeated Words */}
        {analytics.repetitions.repeatedWords.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Repeat className="w-4 h-4 text-primary" />
              <h4 className="font-medium text-foreground text-sm">Repeated Words</h4>
            </div>
            <div className="space-y-1">
              {analytics.repetitions.repeatedWords.slice(0, 5).map((item) => (
                <div key={item.word} className="flex justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{item.word}</span>
                  <span className="font-medium text-foreground">{item.count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weak Sentence Starters */}
        {analytics.sentenceStarters.weak.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <h4 className="font-medium text-foreground text-sm">
                Weak Sentence Starters
              </h4>
            </div>
            <div className="space-y-1">
              {analytics.sentenceStarters.weak.slice(0, 5).map((item) => (
                <div key={item.word} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">"{item.word}"</span>
                  <span className="font-medium text-foreground">{item.count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Suggestions */}
        {analytics.weakWords.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h4 className="font-medium text-foreground text-sm">AI Suggestions</h4>
              </div>
              {analytics.weakWords.some((w) => !w.suggestion) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateSuggestions}
                  disabled={isGeneratingSuggestions}
                  className="h-7 text-xs">
                  {isGeneratingSuggestions ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <Sparkles className="w-3 h-3 mr-1" />
                  )}
                  Generate
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {analytics.weakWords.slice(0, 3).map((item, index) => (
                <div key={index} className="p-2 bg-background/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">
                    Weak word:{" "}
                    <span className="font-medium text-foreground">"{item.word}"</span>
                  </p>
                  <p className="text-xs text-foreground/80 italic">"{item.sentence}"</p>
                  {item.suggestion && (
                    <p className="text-xs text-primary font-medium mt-2">
                      → "{item.suggestion}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
