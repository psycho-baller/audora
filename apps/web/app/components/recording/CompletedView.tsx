import { useState, useEffect } from "react";
import { Play, Pause, Download, Users, Clock, TrendingUp, Sparkles, Phone, Loader2 } from "lucide-react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import SpeechAnalytics from "../analytics/SpeechAnalytics";
import { Button } from "../ui/button";
import { PhoneNumberDialog } from "../network/PhoneNumberDialog";
import { toast } from "sonner";

interface CompletedViewProps {
  conversationId: string;
  conversation: any;
}

export default function CompletedView({
  conversationId,
  conversation,
}: CompletedViewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [otherParticipantId, setOtherParticipantId] = useState<Id<"users"> | null>(null);

  // Get current user
  const currentUser = useQuery(api.users.getCurrentUser);

  const transcriptTurns = useQuery(api.conversations.getTranscript, {
    conversationId: conversationId as Id<"conversations">,
  }) || [];

  const conversationFacts = useQuery(api.conversations.getFacts, {
    conversationId: conversationId as Id<"conversations">,
  }) || [];

  // Get initiator and scanner user data
  const initiatorUser = useQuery(
    api.users.get,
    conversation?.initiatorUserId ? { id: conversation.initiatorUserId } : "skip"
  );
  const scannerUser = useQuery(
    api.users.get,
    conversation?.scannerUserId ? { id: conversation.scannerUserId } : "skip"
  );

  // Get analytics
  const conversationAnalytics = useQuery(api.analytics.getConversationAnalytics, {
    conversationId: conversationId as Id<"conversations">,
  }) || [];

  // Get other participant's phone number
  // @ts-ignore - VAPI types will be available after convex dev
  const otherParticipantPhone = useQuery(
    api.vapi?.getPhoneNumber,
    otherParticipantId ? { userId: otherParticipantId } : "skip"
  );

  // @ts-ignore - VAPI types will be available after convex dev
  const initiateCallAction = useAction(api.vapi?.initiateCall);

  // Filter analytics and facts to only show current user's data
  const currentUserAnalytics = conversationAnalytics.filter(
    (analytics) => currentUser && analytics.userId === currentUser._id
  );

  const currentUserFacts = conversationFacts.filter(
    (fact) => currentUser && fact.userId === currentUser._id
  );

  // Debug log whenever analytics changes
  useEffect(() => {
    console.log("📊 Analytics data updated:", conversationAnalytics);
  }, [conversationAnalytics]);

  const analyzeUserSpeech = useMutation(api.analytics.analyzeUserSpeech);
  const generateSuggestions = useAction(api.analytics.generateWeakWordSuggestions);

  // Auto-analyze current user's speech when conversation is complete
  useEffect(() => {
    const runAnalysis = async () => {
      console.log("=== ANALYTICS EFFECT ===");
      console.log("Conversation:", conversation);
      console.log("Current user:", currentUser);
      console.log("Existing analytics count:", currentUserAnalytics.length);
      console.log("Is analyzing:", isAnalyzing);
      console.log("Transcript turns:", transcriptTurns.length);

      // Only analyze if we have a current user and haven't analyzed them yet
      if (conversation && currentUser && currentUserAnalytics.length === 0 && !isAnalyzing) {
        console.log("✅ Starting analysis for current user...");
        setIsAnalyzing(true);
        try {
          console.log("📊 Analyzing current user:", currentUser._id);
          const result = await analyzeUserSpeech({
            conversationId: conversationId as Id<"conversations">,
            userId: currentUser._id,
          });
          console.log("✅ Analysis complete:", result);
        } catch (error) {
          console.error("❌ Error analyzing speech:", error);
        } finally {
          setIsAnalyzing(false);
          console.log("=== ANALYTICS COMPLETE ===");
        }
      } else {
        if (!conversation) console.log("No conversation data");
        if (!currentUser) console.log("No current user");
        if (currentUserAnalytics.length > 0) console.log("Analytics already exist");
        if (isAnalyzing) console.log("Already analyzing");
      }
    };

    runAnalysis();
  }, [conversation, currentUser, currentUserAnalytics.length, isAnalyzing]);

  const handleGenerateSuggestions = async (userId: Id<"users">) => {
    console.log("=== GENERATING AI SUGGESTIONS ===");
    console.log("User ID:", userId);
    console.log("Conversation ID:", conversationId);

    setIsGeneratingSuggestions(true);
    try {
      const result = await generateSuggestions({
        conversationId: conversationId as Id<"conversations">,
        userId,
      });
      console.log("✅ Suggestions generated:", result);
    } catch (error) {
      console.error("❌ Error generating suggestions:", error);
    } finally {
      setIsGeneratingSuggestions(false);
      console.log("=== SUGGESTIONS COMPLETE ===");
    }
  };

  // Get unique user IDs from transcript
  const userIds = Array.from(
    new Set(transcriptTurns.map((turn) => turn.userId))
  );

  // Determine the other participant (not current user)
  useEffect(() => {
    if (currentUser && userIds.length > 0) {
      const otherId = userIds.find(id => id !== currentUser._id);
      if (otherId) {
        setOtherParticipantId(otherId as Id<"users">);
      }
    }
  }, [currentUser, userIds]);

  // Get current user's facts only
  const currentUserFactsList = currentUserFacts.length > 0 ? currentUserFacts[0].facts : [];

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    // TODO: Implement actual audio playback
  };

  // Helper function to get user name from userId
  const getUserName = (userId: Id<"users">) => {
    if (initiatorUser && userId === conversation.initiatorUserId) {
      return initiatorUser.name || "Speaker 1";
    } else if (scannerUser && userId === conversation.scannerUserId) {
      return scannerUser.name || "Speaker 2";
    }
    return "Unknown";
  };

  const handleCallClick = () => {
    if (otherParticipantPhone) {
      // Phone number exists, initiate call directly
      handleInitiateCall();
    } else {
      // No phone number, show dialog
      setShowPhoneDialog(true);
    }
  };

  const handleInitiateCall = async (newPhoneNumber?: string) => {
    if (!otherParticipantId) return;

    setIsCalling(true);
    try {
      const result = await initiateCallAction({
        contactUserId: otherParticipantId,
        phoneNumber: newPhoneNumber,
      });

      toast.success(`Call initiated successfully with ${result.phoneNumber}`);
    } catch (error: any) {
      console.error("Call failed:", error);
      toast.error(`Failed to initiate call: ${error.message}`);
    } finally {
      setIsCalling(false);
    }
  };

  const handleDownload = () => {
    // Create downloadable transcript
    const transcriptText = transcriptTurns
      .map((turn) => `${getUserName(turn.userId)}: ${turn.text}`)
      .join("\n\n");

    const factsSection = currentUserFactsList.length > 0
      ? `\n\nKey Facts About You:\n${currentUserFactsList.map((fact: string) => `- ${fact}`).join("\n")}`
      : '';

    const fullContent = `CONVERSATION TRANSCRIPT\n\nSummary:\n${
      conversation.summary || "No summary available"
    }\n\n${transcriptText}${factsSection}`;

    const blob = new Blob([fullContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${conversationId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateDuration = () => {
    if (conversation.startedAt && conversation.endedAt) {
      const durationMs = conversation.endedAt - conversation.startedAt;
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
    return "N/A";
  };

  return (
    <div className="w-full space-y-6 pb-8">
      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-xl font-semibold text-foreground">Conversation Complete</h2>
          <div className="flex items-center space-x-2 flex-wrap">
            {otherParticipantId && (
              <Button
                onClick={handleCallClick}
                disabled={isCalling}
                size="sm"
                variant="default"
                className="gap-2">
                {isCalling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calling...
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4" />
                    Reflect on conversation with {getUserName(otherParticipantId)}
                  </>
                )}
              </Button>
            )}
            <button
              onClick={handlePlayPause}
              className="p-2 bg-primary hover:bg-primary/90 rounded-lg transition-colors">
              {isPlaying ? (
                <Pause className="w-4 h-4 text-primary-foreground" />
              ) : (
                <Play className="w-4 h-4 text-primary-foreground" />
              )}
            </button>
            <button
              onClick={handleDownload}
              className="p-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors">
              <Download className="w-4 h-4 text-foreground" />
            </button>
          </div>
        </div>

        {/* Conversation Stats */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{calculateDuration()}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{userIds.length} participants</span>
          </div>
          <div className="text-muted-foreground">
            {formatDate(conversation._creationTime)}
          </div>
        </div>
      </div>

      {/* Analytics Toggle */}
      <div className="flex items-center justify-between">
        <Button
          variant={showAnalytics ? "default" : "outline"}
          onClick={() => setShowAnalytics(!showAnalytics)}
          className="gap-2">
          <TrendingUp className="w-4 h-4" />
          {showAnalytics ? "Hide" : "Show"} Analytics
        </Button>
        {currentUserAnalytics.length > 0 && !isGeneratingSuggestions && currentUser && (
          <Button
            variant="outline"
            onClick={() => {
              handleGenerateSuggestions(currentUser._id);
            }}
            className="gap-2">
            <Sparkles className="w-4 h-4" />
            Get AI Suggestions
          </Button>
        )}
      </div>

      {/* Analytics Display - Current User Only */}
      {showAnalytics && currentUserAnalytics.length > 0 && (
        <div className="space-y-6">
          {currentUserAnalytics.map((analytics) => (
            <div key={analytics._id} className="bg-muted/30 rounded-xl p-4">
              <SpeechAnalytics
                analytics={analytics}
                userName={currentUser?.name || "You"}
              />
            </div>
          ))}
        </div>
      )}

      {isAnalyzing && (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <div className="inline-flex items-center gap-2 text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Analyzing communication patterns...</span>
          </div>
        </div>
      )}

      {/* User Filter */}
      {userIds.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedUserId(null)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              selectedUserId === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}>
            All Participants
          </button>
          {userIds.map((userId) => (
            <button
              key={userId}
              onClick={() => setSelectedUserId(userId)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedUserId === userId
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}>
              {getUserName(userId as Id<"users">)}
            </button>
          ))}
        </div>
      )}

      {/* Transcript */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-foreground mb-4">Transcript</h3>
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {transcriptTurns
            .filter((turn) => !selectedUserId || turn.userId === selectedUserId)
            .map((turn, index) => {
              const userName = getUserName(turn.userId);
              return (
                <div key={turn._id} className="flex space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-xs font-medium text-primary-foreground">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium text-foreground">
                        {userName}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{turn.text}</p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Key Facts - Current User Only */}
      {currentUserFactsList.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-foreground mb-4">Key Facts About You</h3>
          <ul className="space-y-2">
            {currentUserFactsList.map((fact: string, index: number) => (
              <li
                key={index}
                className="text-muted-foreground text-sm flex items-start">
                <span className="text-primary mr-2 mt-1">•</span>
                <span className="flex-1">{fact}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Phone Number Dialog */}
      {otherParticipantId && (
        <PhoneNumberDialog
          open={showPhoneDialog}
          onOpenChange={setShowPhoneDialog}
          contactName={getUserName(otherParticipantId)}
          onSubmit={handleInitiateCall}
        />
      )}
    </div>
  );
}
