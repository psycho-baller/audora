import { api } from "@audora/backend/convex/_generated/api";
import type { Id } from "@audora/backend/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ChevronRight,
  Lightbulb,
  Loader2,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

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

      <Tabs defaultValue="word-choice" className="flex flex-col h-full min-h-0">
        <TabsList className="shrink-0 mb-4">
          <TabsTrigger value="word-choice">Word Choice</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
        </TabsList>

        {/* Word Choice Tab */}
        <TabsContent value="word-choice" className="flex-1 min-h-0 overflow-hidden">
          <div className="space-y-4 overflow-auto h-full pr-3 custom-scrollbar">
            {/* What went well */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <h4 className="font-medium text-foreground text-sm">What went well</h4>
              </div>
              
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
                      <div className="space-y-1">
                        {analytics.repetitions.repeatedWords.slice(0, 5).map((item) => (
                          <div key={item.word} className="flex justify-between text-sm">
                            <span className="text-muted-foreground capitalize">{item.word}</span>
                            <span className="font-medium text-foreground">{item.count}x</span>
                          </div>
                        ))}
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
                </details>
              </div>
            </div>

            {/* What could have gone better */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-yellow-400" />
                <h4 className="font-medium text-foreground text-sm">What could have gone better</h4>
              </div>
              
              <div className="space-y-2">
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
                      <div className="space-y-1">
                        {analytics.sentenceStarters.weak.slice(0, 5).map((item) => (
                          <div key={item.word} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">"{item.word}"</span>
                            <span className="font-medium text-foreground">{item.count}x</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Delivery Tab */}
        <TabsContent value="delivery" className="flex-1 min-h-0 overflow-hidden">
          <div className="space-y-4 overflow-auto h-full pr-3 custom-scrollbar">
            {/* What went well */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <h4 className="font-medium text-foreground text-sm">What went well</h4>
              </div>
              
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
              </div>
            </div>

            {/* What could have gone better */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-yellow-400" />
                <h4 className="font-medium text-foreground text-sm">What could have gone better</h4>
              </div>
              
              <div className="space-y-2">
                {/* Pacing */}
                <details className="group bg-muted/30 rounded-lg">
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
                    <p className="text-xs text-muted-foreground">
                      {analytics.pacing.wordsPerMinute < 100
                        ? "Speaking slowly - good for clarity"
                        : analytics.pacing.wordsPerMinute > 160
                          ? "Speaking quickly - consider slowing down"
                          : "Good speaking pace (120-150 words/min is ideal)"}
                    </p>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
