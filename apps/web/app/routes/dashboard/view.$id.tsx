"use client";

import { api } from "@audora/backend/convex/_generated/api";
import type { Id } from "@audora/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { AlertCircle, ArrowLeft, Clock, Loader2, Users } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { Button } from "~/components/ui/button";

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: Id<"conversations"> }>();
  const navigate = useNavigate();

  // Fetch conversation data
  const conversation = useQuery(
    api.conversations.get,
    id ? { id: id as Id<"conversations"> } : "skip"
  );

  // Fetch transcript
  const transcript = useQuery(
    api.conversations.getTranscript,
    id ? { conversationId: id as Id<"conversations"> } : "skip"
  );

  // Fetch audio URL
  const audioUrl = useQuery(
    api.conversations.getAudioUrl,
    id ? { conversationId: id as Id<"conversations"> } : "skip"
  );

  // Loading state
  if (conversation === undefined || transcript === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  // Error states
  if (!id || conversation === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <div>
            <p className="text-foreground font-medium mb-1">Conversation not found</p>
            <p className="text-sm text-muted-foreground">
              This conversation may have been deleted or doesn't exist.
            </p>
          </div>
          <Button onClick={() => navigate("/dashboard")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Helper functions
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = () => {
    if (conversation.startedAt && conversation.endedAt) {
      const durationMs = conversation.endedAt - conversation.startedAt;
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
    return "N/A";
  };

  const getConversationTitle = () => {
    return conversation.location || `Conversation ${conversation._id.slice(0, 8)}`;
  };

  const participantCount = transcript
    ? new Set(transcript.map((turn) => turn.userId)).size
    : 0;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {getConversationTitle()}
                </h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{formatDuration()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{participantCount} participants</span>
                  </div>
                  <span>{formatDate(conversation._creationTime)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column: Audio player & Transcript (60%) */}
        <div className="flex-[3] border-r border-border flex flex-col h-full min-h-0">
          <div className="flex flex-col p-6 h-full min-h-0">
            {/* Audio Player Placeholder */}
            <div className="bg-card border border-border rounded-lg p-6 mb-6 shrink-0">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Audio Player
              </h2>
              {audioUrl ? (
                <div className="text-sm text-muted-foreground">
                  <p className="mb-2">Audio URL: {audioUrl}</p>
                  <p className="text-xs text-muted-foreground">
                    (Audio player component will be implemented in Part 2)
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-2">No audio available</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/dashboard/import")}>
                    Import Audio
                  </Button>
                </div>
              )}
            </div>

            {/* Transcript Placeholder */}
            <div className="bg-card border border-border rounded-lg p-6 flex flex-col flex-1 min-h-0">
              <h2 className="text-lg font-semibold text-foreground mb-4 shrink-0">
                Transcript
              </h2>
              {transcript && transcript.length > 0 ? (
                <div className="space-y-4 overflow-auto flex-1 min-h-0">
                  {transcript.map((turn, index) => (
                    <div
                      key={turn._id}
                      className={`p-4 rounded-lg ${
                        index % 2 === 0 ? "bg-muted/30" : "bg-muted/50"
                      }`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                            {index % 2 === 0 ? "S1" : "S2"}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">
                              Speaker {index % 2 === 0 ? "1" : "2"}
                            </span>
                            {turn.timestamp !== undefined && (
                              <span className="text-xs text-muted-foreground">
                                {Math.floor(turn.timestamp / 60)}:
                                {String(Math.floor(turn.timestamp % 60)).padStart(2, "0")}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {turn.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No transcript available
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Analytics (40%) */}
        <div className="flex-[2] overflow-auto bg-muted/10">
          <div className="p-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Analytics
              </h2>
              <p className="text-sm text-muted-foreground text-center py-8">
                Analytics dashboard will be implemented in Part 4
              </p>
              <div className="space-y-4 mt-4">
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Coming soon:</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li>• Communication Scores (Clarity, Conciseness, Confidence)</li>
                    <li>• Filler Word Detection</li>
                    <li>• Speaking Pace Analysis</li>
                    <li>• Word Choice Insights</li>
                    <li>• AI Coaching Feedback</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


