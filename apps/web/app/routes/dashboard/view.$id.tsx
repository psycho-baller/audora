import { api } from "@audora/backend/convex/_generated/api";
import type { Id } from "@audora/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { AlertCircle, ArrowLeft, Calendar, Clock, Loader2, MessageSquare, MoveUpLeft, Share2, Users } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { AnalyticsPanel } from "~/components/dashboard/analytics-panel";
import { TranscriptChatbot } from "~/components/dashboard/transcript-chatbot";
import { ExportDialog } from "~/components/export/ExportDialog";
import CurrentView from "~/components/recording/CurrentView";
import PendingView from "~/components/recording/PendingView";
import TranscriptPlayer from "~/components/transcript/TranscriptPlayer";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { AudioPlaybackProvider } from "~/hooks/use-audio-playback";
import { getConversationDisplayTitle } from "~/lib/conversation-context";

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: Id<"conversations"> }>();
  const navigate = useNavigate();

  // Fetch conversation data
  const conversation = useQuery(
    api.conversations.get,
    id ? { id: id as Id<"conversations"> } : "skip"
  );

  // Fetch transcript (only needed for ended conversations)
  const transcript = useQuery(
    api.conversations.getTranscript,
    id && conversation?.status === "ended" ? { conversationId: id as Id<"conversations"> } : "skip"
  );

  // Fetch audio URL (only needed for ended conversations)
  const audioUrl = useQuery(
    api.conversations.getAudioUrl,
    id && conversation?.status === "ended" ? { conversationId: id as Id<"conversations"> } : "skip"
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

  // Loading state - only wait for conversation data initially
  if (conversation === undefined) {
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

  // For pending and active conversations, show the recording UI
  if (conversation.status === "pending" || conversation.status === "active") {
    const conversationTitle = getConversationDisplayTitle(conversation);
    const getStatusColor = () => {
      switch (conversation.status) {
        case "active":
          return "bg-green-500/10 text-green-500 border-green-500/20";
        case "pending":
          return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
        default:
          return "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20";
      }
    };

    return (
      <div className="h-full bg-background flex flex-col">
        {/* Header Bar */}
        <div className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 rounded-lg hover:bg-muted transition-colors group">
              <MoveUpLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
            </button>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <h1 className="text-sm font-semibold text-foreground">
                  {conversationTitle}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {conversation.status === "pending" ? "Waiting to begin" : "Recording in progress"}
                </p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
                {conversation.status.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="min-h-full flex justify-center p-4 md:p-6">
            <div className="w-full max-w-4xl">
              {conversation.status === "pending" ? (
                <PendingView conversationId={id} conversation={conversation} />
              ) : (
                <CurrentView conversationId={id} />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // For ended conversations, wait for transcript data too
  if (transcript === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading conversation...</p>
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
    return getConversationDisplayTitle(conversation);
  };

  const participantCount = transcript
    ? new Set(
        transcript.map((turn) =>
          turn.userId ? `user:${turn.userId}` : `speaker:${turn.speaker || "unknown"}`
        )
      ).size
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

      <Tabs defaultValue="analytics" className="flex flex-1 min-h-0 flex-col gap-0">
        <div className="border-b border-border bg-background px-4 sm:px-6">
          <TabsList className="h-auto w-full justify-start rounded-none bg-transparent p-0">
            <TabsTrigger
              value="analytics"
              className="h-12 flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-3 pt-4 text-base text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none sm:px-4"
            >
              Analytics
            </TabsTrigger>
            <TabsTrigger
              value="transcript"
              className="h-12 flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-5 pb-3 pt-4 text-base text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none sm:px-4"
            >
              Transcript
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="analytics" className="min-h-0 flex-1 overflow-hidden p-4 sm:p-6">
          <AnalyticsPanel showHeader={false} conversationId={id as Id<"conversations">} />
        </TabsContent>

        <TabsContent value="transcript" className="min-h-0 flex-1 overflow-hidden p-4 sm:p-6">
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
          >
            <TranscriptChatbot conversationId={id as Id<"conversations">} />
          </TranscriptPlayer>
        </TabsContent>
      </Tabs>
    </div>
    </AudioPlaybackProvider>
  );
}
