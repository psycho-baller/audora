import { api } from "@audora/backend/convex/_generated/api";
import { useAuth } from "@clerk/react-router";
import { useMutation } from "convex/react";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import ConversationHistory from "../components/ConversationHistory";
import { Button } from "../components/ui/button";
import { buildConversationContextLabel } from "../lib/conversation-context";

export default function RecordPage() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const createConversation = useMutation(api.conversations.create);
  const [isCreating, setIsCreating] = useState(false);

  if (!isSignedIn) {
    const redirectUrl = typeof window !== "undefined" ? encodeURIComponent(window.location.href) : "";
    console.log("Redirecting to sign-in with URL:", redirectUrl);
    navigate(`/sign-in?redirect_url=${redirectUrl}`);
    return null;
  }

  const handleStartRecording = async () => {
    try {
      setIsCreating(true);
      const result = await createConversation({
        location: buildConversationContextLabel("live"),
      });
      navigate(`/dashboard/conversations/${result.id}`);
    } catch (error) {
      console.error("Failed to create conversation:", error);
      toast.error("Failed to start recording. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">
                Conversations
              </h1>
              <p className="text-sm text-muted-foreground">
                View and manage your conversation history
              </p>
            </div>
            <Button
              onClick={handleStartRecording}
              disabled={isCreating}
              size="lg"
              className="w-full sm:w-auto">
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
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <ConversationHistory />
        </div>
      </div>
    </div>
  );
}
