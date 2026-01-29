import { api } from "@audora/backend/convex/_generated/api";
import type { Id } from "@audora/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { AlertCircle, ArrowLeft, BarChart3, Calendar, Clock, Loader2, MessageSquare, Share2, Users, X } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AnalyticsPanel } from "~/components/dashboard/analytics-panel";
import { TranscriptChatbot } from "~/components/dashboard/transcript-chatbot";
import { ExportDialog } from "~/components/export/ExportDialog";
import TranscriptPlayer from "~/components/transcript/TranscriptPlayer";
import { Button } from "~/components/ui/button";
import { AudioPlaybackProvider } from "~/hooks/use-audio-playback";

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: Id<"conversations"> }>();
  const navigate = useNavigate();
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const closeAnalytics = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsAnalyticsOpen(false);
      setIsClosing(false);
    }, 300);
  };

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

  // Fetch initiator and scanner user data for speaker names
  const initiatorUser = useQuery(
    api.users.get,
    conversation?.initiatorUserId ? { id: conversation.initiatorUserId } : "skip"
  );
  const scannerUser = useQuery(
    api.users.get,
    conversation?.scannerUserId ? { id: conversation.scannerUserId } : "skip"
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
    <AudioPlaybackProvider>
    <div className="flex flex-col h-full bg-background">
      {/* Enhanced Header */}
      <div className="border-b border-border bg-card backdrop-blur-sm shadow-sm">
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            {/* Left section */}
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="gap-2 shrink-0 hover:bg-muted/80">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-foreground truncate">
                    {getConversationTitle()}
                  </h1>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    conversation.status === 'ended' 
                      ? 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20' 
                      : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                  }`}>
                    {conversation.status === 'ended' ? 'Completed' : 'Active'}
                  </span>
                </div>
                <div className="flex items-center gap-5 text-sm text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(conversation._creationTime)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>{formatDuration()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span>{participantCount} {participantCount === 1 ? 'participant' : 'participants'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4" />
                    <span>{transcript?.length || 0} turns</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right section - Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <ExportDialog 
                conversationId={id as Id<"conversations">}
                trigger={
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 hover:bg-muted/80"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Share & Export</span>
                    <span className="sm:hidden">Share</span>
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout - Responsive */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left column: TranscriptPlayer (audio + transcript) */}
        <div className="flex-1 lg:flex-[3] border-b lg:border-b-0 lg:border-r border-border flex flex-col h-full min-h-0 relative">
          <div className="flex flex-col p-4 sm:p-6 h-full min-h-0">
            <TranscriptPlayer
              conversationId={id as Id<"conversations">}
              getUserName={(userId) => {
                if (!userId) return "Unknown";
                if (initiatorUser && userId === conversation?.initiatorUserId) {
                  return initiatorUser.name || "Speaker 1";
                }
                if (scannerUser && userId === conversation?.scannerUserId) {
                  return scannerUser.name || "Speaker 2";
                }
                return "Speaker";
              }}
            />
          </div>
          <TranscriptChatbot conversationId={id as Id<"conversations">} />
        </div>

        {/* Right column: Analytics - hidden on mobile, shown in modal */}
        <div className="hidden lg:flex lg:flex-col lg:flex-[2] h-full min-h-0">
          <div className="p-6 flex flex-col h-full min-h-0">
            <div className="bg-card border border-border rounded-lg p-6 flex flex-col h-full min-h-0">
              <h2 className="text-lg font-semibold text-foreground mb-4 shrink-0">
                Analytics
              </h2>
              <div className="flex-1 min-h-0">
                <AnalyticsPanel showHeader={false} conversationId={id as Id<"conversations">} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile bottom nav bar - shown on small screens */}
      <div className="lg:hidden border-t border-border bg-card backdrop-blur-sm p-3 shrink-0">
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => setIsAnalyticsOpen(true)}
        >
          <BarChart3 className="w-4 h-4" />
          View Analytics
        </Button>
      </div>

      {/* Mobile Analytics slide-in panel */}
      {isAnalyticsOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
            onClick={closeAnalytics}
          />
          {/* Panel */}
          <div className={`absolute right-0 top-0 h-full w-full max-w-md bg-background shadow-xl transition-transform duration-300 ${isClosing ? 'translate-x-full' : 'translate-x-0 animate-in slide-in-from-right'}`}>
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={closeAnalytics}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-6 pr-3 custom-scrollbar">
                <div className="bg-card border border-border rounded-lg p-6">
                  <AnalyticsPanel showHeader={false} conversationId={id as Id<"conversations">} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </AudioPlaybackProvider>
  );
}
