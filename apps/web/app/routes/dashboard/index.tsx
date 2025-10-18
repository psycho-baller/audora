"use client";

import { useAuth } from "@clerk/react-router";
import { useNavigate } from "react-router";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import ConversationHistory from "../../components/ConversationHistory";
import { Users, Phone, Loader2, Plus, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";

export default function Page() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const createConversation = useMutation(api.conversations.create);
  const [isCreating, setIsCreating] = useState(false);

  if (!isSignedIn) {
    navigate("/sign-in");
    return null;
  }

  const handleStartRecording = async () => {
    try {
      setIsCreating(true);
      const result = await createConversation({
        location: "Mount Royal University Library",
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
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">
                Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Welcome back! Start a new conversation or view your history
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
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
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Conversations</h2>
          <ConversationHistory />
        </div>
      </div>

      {/* Quick Actions Footer - Mobile Only */}
      <div className="sm:hidden border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-around gap-2">
            <a
              href="/dashboard/network"
              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-muted transition-colors">
              <Users className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Network</span>
            </a>

            <a
              href={`tel:${import.meta.env.VITE_TWILIO_PHONE_NUMBER || ""}`}
              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-muted transition-colors">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Call</span>
            </a>

            <a
              href="https://wa.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-muted transition-colors">
              <svg
                className="w-5 h-5 text-muted-foreground"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg">
                <path d="M17.6 6.32A8.78 8.78 0 0 0 12.23 4 8.91 8.91 0 0 0 3.39 13a9 9 0 0 0 1.28 4.57L3.26 22l4.51-1.17a8.91 8.91 0 0 0 13.14-7.72 8.83 8.83 0 0 0-3.31-6.79ZM12.23 20.26a7.43 7.43 0 0 1-3.8-1l-.27-.16-2.82.74.76-2.76-.18-.28a7.42 7.42 0 0 1-1.17-4 7.4 7.4 0 0 1 7.44-7.44 7.54 7.54 0 0 1 5.34 2.2 7.31 7.31 0 0 1 2.17 5.25 7.43 7.43 0 0 1-7.47 7.45Zm4.07-5.55c-.22-.11-1.32-.65-1.53-.73s-.35-.11-.5.11-.58.73-.71.88-.26.17-.48.06a6 6 0 0 1-1.78-1.09 6.81 6.81 0 0 1-1.23-1.53c-.13-.22 0-.34.1-.45s.22-.25.33-.38a1.41 1.41 0 0 0 .22-.36.41.41 0 0 0 0-.38c0-.11-.5-1.2-.69-1.65s-.36-.37-.5-.38h-.42a.82.82 0 0 0-.58.27 2.41 2.41 0 0 0-.78 1.81 4.28 4.28 0 0 0 .88 2.25 9.6 9.6 0 0 0 3.73 3.26 12.32 12.32 0 0 0 1.24.46 3 3 0 0 0 1.38.09 2.3 2.3 0 0 0 1.5-1.06 1.85 1.85 0 0 0 .13-1.06c-.05-.08-.19-.13-.41-.24Z" />
              </svg>
              <span className="text-xs text-muted-foreground">WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
