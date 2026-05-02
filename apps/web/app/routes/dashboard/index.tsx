"use client";

import { api } from "@audora/backend/convex/_generated/api";
import { useAuth, useUser } from "@clerk/react-router";
import { useMutation, useQuery } from "convex/react";
import {
    Loader2,
    MessageSquare,
    Plus,
    Sparkles,
    Upload,
    Wand2,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { buildConversationContextLabel } from "~/lib/conversation-context";
import ConversationHistory from "../../components/ConversationHistory";
import { Button } from "../../components/ui/button";

export default function Page() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const createConversation = useMutation(api.conversations.create);
  const weeklyProgress = useQuery(api.analytics.getWeeklyProgress);
  const [isCreating, setIsCreating] = useState(false);

  if (!isSignedIn) {
    navigate("/sign-in");
    return null;
  }

  const handleStartRecording = async () => {
    try {
      setIsCreating(true);
      const result = await createConversation({
        location: buildConversationContextLabel("live"),
      });
      navigate(`/dashboard/record/${result.id}`);
    } catch (error) {
      console.error("Failed to create conversation:", error);
      toast.error("Failed to start recording. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const firstName =
    user?.firstName ||
    user?.fullName?.split(" ")[0] ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "there";

  const historyActions = (
    <>
      <Button
        onClick={() => navigate("/dashboard/import")}
        disabled={isCreating}
        size="lg"
        variant="outline"
        className="flex-1 sm:flex-none">
        <Upload className="w-4 h-4 mr-2" />
        Import Audio
      </Button>
      <Button
        onClick={handleStartRecording}
        disabled={isCreating}
        size="lg"
        className="flex-1 sm:flex-none">
        {isCreating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <Plus className="w-4 h-4 mr-2" />
            New Conversation
          </>
        )}
      </Button>
    </>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="border-b border-border bg-sidebar dark:bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">
                Welcome back, {firstName}
              </h1>
              <p className="text-sm text-muted-foreground">
                Start a new conversation or view your history
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-7 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              Weekly Progress
            </h2>
            <WeeklyProgressCards progress={weeklyProgress} />
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">History</h2>
            <div className="rounded-2xl border border-border bg-sidebar dark:bg-card">
              <div className="px-4 py-4 sm:px-6 sm:py-6">
                <ConversationHistory headerActions={historyActions} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function WeeklyProgressCards({
  progress,
}: {
  progress:
    | {
        conversations: {
          current: number;
          previous: number;
          change: number;
        };
        confidence: {
          current: number | null;
          previous: number | null;
          changePercent: number | null;
        };
        fillerWords: {
          currentRate: number | null;
          previousRate: number | null;
          reductionPercent: number | null;
        };
      }
    | null
    | undefined;
}) {
  const isLoading = progress === undefined;

  const cards = [
    {
      title: "Practice Sessions",
      value: isLoading ? "..." : `${progress?.conversations.current ?? 0} this week`,
      description:
        progress?.conversations.change === undefined
          ? "Conversation activity will appear here."
          : formatDelta(progress.conversations.change, "from last week"),
      icon: MessageSquare,
    },
    {
      title: "Confident Tone",
      value: isLoading
        ? "..."
        : progress?.confidence.changePercent !== null &&
            progress?.confidence.changePercent !== undefined
          ? `${formatSigned(progress.confidence.changePercent)}%`
          : progress?.confidence.current !== null &&
              progress?.confidence.current !== undefined
            ? `${progress.confidence.current}/100`
            : "No score yet",
      description:
        progress?.confidence.changePercent !== null &&
        progress?.confidence.changePercent !== undefined
          ? progress.confidence.changePercent >= 0
            ? "Improvement from your previous week."
            : "Change from your previous week."
          : "Based on your average confidence score.",
      icon: Sparkles,
    },
    {
      title: "Cleaner Speech",
      value: isLoading
        ? "..."
        : progress?.fillerWords.reductionPercent !== null &&
            progress?.fillerWords.reductionPercent !== undefined
          ? `${formatSigned(progress.fillerWords.reductionPercent)}%`
          : progress?.fillerWords.currentRate !== null &&
              progress?.fillerWords.currentRate !== undefined
            ? `${progress.fillerWords.currentRate}/min`
            : "No rate yet",
      description:
        progress?.fillerWords.reductionPercent !== null &&
        progress?.fillerWords.reductionPercent !== undefined
          ? progress.fillerWords.reductionPercent >= 0
            ? "Filler word rate reduction from last week."
            : "Filler word rate change from last week."
          : "Average filler words per minute this week.",
      icon: Wand2,
    },
  ];

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:overflow-visible md:px-0 md:pb-0">
      <div className="flex snap-x snap-mandatory gap-3 md:grid md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.title}
              className="min-w-[260px] snap-start rounded-lg border border-border bg-card px-5 py-4 shadow-sm dark:bg-card md:min-w-0"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <Icon className="size-4 text-primary" />
              </div>
              <p className="text-xl font-semibold text-primary">{card.value}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {card.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatSigned(value: number) {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function formatDelta(value: number, suffix: string) {
  if (value > 0) return `+${value} ${suffix}`;
  if (value < 0) return `${value} ${suffix}`;
  return `No change ${suffix}`;
}
