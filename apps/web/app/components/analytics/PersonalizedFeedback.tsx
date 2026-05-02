import { api } from "@audora/backend/convex/_generated/api";
import type { Id } from "@audora/backend/convex/_generated/dataModel";
import { useAction, useQuery } from "convex/react";
import { AlertCircle, CheckCircle2, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";

interface PersonalizedFeedbackProps {
  conversationId: Id<"conversations">;
  userId: Id<"users">;
}

export function PersonalizedFeedback({ conversationId, userId }: PersonalizedFeedbackProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationFailed, setGenerationFailed] = useState(false);
  const autoGenerateStarted = useRef(false);

  const feedback = useQuery(api.analytics.getPersonalizedFeedback, {
    conversationId,
    userId,
  });

  const generateFeedback = useAction(api.analytics.generatePersonalizedFeedback);

  const handleGenerateFeedback = async () => {
    setIsGenerating(true);
    setGenerationFailed(false);
    try {
      const result = await generateFeedback({ conversationId, userId });
      if (!result) {
        setGenerationFailed(true);
      }
    } catch (error) {
      console.error("Error generating feedback:", error);
      setGenerationFailed(true);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    autoGenerateStarted.current = false;
    setGenerationFailed(false);
  }, [conversationId, userId]);

  useEffect(() => {
    if (feedback !== null || isGenerating || generationFailed || autoGenerateStarted.current) return;

    autoGenerateStarted.current = true;
    void handleGenerateFeedback();
  }, [feedback, isGenerating, generationFailed]);

  if (feedback === undefined) {
    return (
      <div className="rounded-xl border border-primary/10 bg-primary/5 p-6 dark:border-primary/15 dark:bg-primary/[0.08]">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="rounded-xl border border-primary/10 bg-primary/5 p-6 dark:border-primary/15 dark:bg-primary/[0.08]">
        <div className="flex items-start gap-4">
          <div className="shrink-0 rounded-lg bg-primary/10 p-3">
            {generationFailed ? (
              <AlertCircle className="h-6 w-6 text-primary" />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              {generationFailed ? "AI Insights Unavailable" : "Generating AI Insights"}
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {generationFailed
                ? "We could not generate insights for this conversation yet. This usually means analytics are still being prepared or the AI service is unavailable."
                : "We are creating personalized insights for this conversation. They will be saved here automatically once ready."}
            </p>
            {generationFailed && (
              <Button onClick={handleGenerateFeedback} disabled={isGenerating} className="gap-2">
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Try Again
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const needsWorkTitle = feedback.improvements?.[0] || "Keep tightening your delivery";
  const improvingTitle =
    feedback.comparisonToPrevious || feedback.actionItems?.[0] || "Building consistency";
  const strongSkillTitle = feedback.strengths?.[0] || "Clear communication habits";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 dark:border-primary/15 dark:bg-primary/[0.08]">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-lg bg-primary/10 p-2">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">Personalized Feedback</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {feedback.summary}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 dark:border-primary/15 dark:bg-primary/[0.08]">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-full bg-red-500/10 p-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-foreground">Needs Work</h4>
            <p className="mt-0.5 text-xs font-medium text-red-500">{needsWorkTitle}</p>
            {feedback.actionItems && feedback.actionItems.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                {feedback.actionItems.slice(0, 2).map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 dark:border-primary/15 dark:bg-primary/[0.08]">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-full bg-yellow-500/10 p-2">
            <TrendingUp className="h-4 w-4 text-yellow-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-foreground">Currently Improving</h4>
            <p className="mt-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
              {improvingTitle}
            </p>
            {feedback.improvements && feedback.improvements.length > 1 && (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                {feedback.improvements.slice(1, 3).map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 dark:border-primary/15 dark:bg-primary/[0.08]">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-full bg-green-500/10 p-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-foreground">Strong Skill</h4>
            <p className="mt-0.5 text-xs font-medium text-green-600 dark:text-green-400">
              {strongSkillTitle}
            </p>
            {feedback.strengths && feedback.strengths.length > 1 && (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                {feedback.strengths.slice(1, 3).map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
