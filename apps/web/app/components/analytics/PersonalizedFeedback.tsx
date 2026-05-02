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

  const strengths = feedback.strengths ?? [];
  const improvements = feedback.improvements ?? [];
  const actionItems = feedback.actionItems ?? [];
  const generatedAtLabel = new Date(feedback.generatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 dark:border-primary/15 dark:bg-primary/[0.08]">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-lg bg-primary/10 p-2">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Personalized Feedback</h3>
              <span className="text-[11px] text-muted-foreground">{generatedAtLabel}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {feedback.summary}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 dark:border-primary/15 dark:bg-primary/[0.08]">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-full bg-green-500/10 p-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-foreground">Strengths</h4>
            {strengths.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                {strengths.map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">No strengths were generated yet.</p>
            )}
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
            {improvements.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                {improvements.map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">No improvement areas were generated yet.</p>
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
            <h4 className="text-sm font-semibold text-foreground">Action Items</h4>
            {actionItems.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                {actionItems.map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">No action items were generated yet.</p>
            )}
          </div>
        </div>
      </div>

      {feedback.comparisonToPrevious && (
        <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 dark:border-primary/15 dark:bg-primary/[0.08]">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-full bg-primary/10 p-2">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-foreground">Compared With Previous</h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {feedback.comparisonToPrevious}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
