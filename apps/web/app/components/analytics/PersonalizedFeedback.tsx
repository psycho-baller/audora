import { api } from "@audora/backend/convex/_generated/api";
import type { Id } from "@audora/backend/convex/_generated/dataModel";
import { useAction, useQuery } from "convex/react";
import { Sparkles, Loader2, TrendingUp, Target, Lightbulb, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";

interface PersonalizedFeedbackProps {
  conversationId: Id<"conversations">;
  userId: Id<"users">;
}

export function PersonalizedFeedback({ conversationId, userId }: PersonalizedFeedbackProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Query for existing feedback
  const feedback = useQuery(
    api.analytics.getPersonalizedFeedback,
    { conversationId, userId }
  );
  
  const generateFeedback = useAction(api.analytics.generatePersonalizedFeedback);
  
  const handleGenerateFeedback = async () => {
    setIsGenerating(true);
    try {
      await generateFeedback({ conversationId, userId });
    } catch (error) {
      console.error("Error generating feedback:", error);
    } finally {
      setIsGenerating(false);
    }
  };
  
  if (feedback === undefined) {
    return (
      <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 rounded-xl p-6 border border-primary/10">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      </div>
    );
  }
  
  if (!feedback) {
    return (
      <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 rounded-xl p-6 border border-primary/10">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg shrink-0">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              AI Personalized Feedback
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get personalized insights and actionable recommendations based on your speech patterns, 
              communication style, and areas for improvement.
            </p>
            <Button
              onClick={handleGenerateFeedback}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate AI Feedback
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Overall Summary */}
      <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 rounded-xl p-6 border border-primary/10">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground mb-1">
              AI Personalized Feedback
            </h3>
            <p className="text-xs text-muted-foreground">
              Based on your speech patterns and communication style
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerateFeedback}
            disabled={isGenerating}
            className="gap-1 text-xs"
          >
            {isGenerating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Refresh
          </Button>
        </div>
        
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-sm text-foreground leading-relaxed">
            {feedback.summary}
          </p>
        </div>
      </div>
      
      {/* Strengths */}
      {feedback.strengths && feedback.strengths.length > 0 && (
        <div className="bg-green-500/5 rounded-xl p-5 border border-green-500/10">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500" />
            <h4 className="text-sm font-semibold text-foreground">Your Strengths</h4>
          </div>
          <ul className="space-y-2">
            {feedback.strengths.map((strength: string, index: number) => (
              <li key={index} className="flex items-start gap-2 text-sm text-foreground">
                <span className="text-green-600 dark:text-green-500 mt-0.5">•</span>
                <span className="flex-1">{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Areas for Improvement */}
      {feedback.improvements && feedback.improvements.length > 0 && (
        <div className="bg-orange-500/5 rounded-xl p-5 border border-orange-500/10">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-orange-600 dark:text-orange-500" />
            <h4 className="text-sm font-semibold text-foreground">Areas to Improve</h4>
          </div>
          <ul className="space-y-2">
            {feedback.improvements.map((improvement: string, index: number) => (
              <li key={index} className="flex items-start gap-2 text-sm text-foreground">
                <span className="text-orange-600 dark:text-orange-500 mt-0.5">•</span>
                <span className="flex-1">{improvement}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Action Items */}
      {feedback.actionItems && feedback.actionItems.length > 0 && (
        <div className="bg-blue-500/5 rounded-xl p-5 border border-blue-500/10">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-500" />
            <h4 className="text-sm font-semibold text-foreground">Action Items</h4>
          </div>
          <ul className="space-y-2.5">
            {feedback.actionItems.map((item: string, index: number) => (
              <li key={index} className="flex items-start gap-2.5 text-sm">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-500 text-xs font-semibold shrink-0 mt-0.5">
                  {index + 1}
                </div>
                <span className="flex-1 text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Progress Tracking */}
      {feedback.comparisonToPrevious && (
        <div className="bg-purple-500/5 rounded-xl p-5 border border-purple-500/10">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-500" />
            <h4 className="text-sm font-semibold text-foreground">Your Progress</h4>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {feedback.comparisonToPrevious}
          </p>
        </div>
      )}
    </div>
  );
}

