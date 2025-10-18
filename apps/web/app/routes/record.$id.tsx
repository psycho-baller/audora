import { useParams, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { MoveUpLeft, Loader2, AlertCircle } from "lucide-react";
import PendingView from "../components/recording/PendingView";
import CurrentView from "../components/recording/CurrentView";
import CompletedView from "../components/recording/CompletedView";
import { Button } from "../components/ui/button";

export default function ConversationPage() {
  const { id } = useParams<{ id: Id<"conversations"> }>();
  const navigate = useNavigate();
  const conversation = useQuery(api.conversations.get, { id: id as Id<"conversations"> });

  if (!id) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <p className="text-foreground font-medium">Invalid conversation ID</p>
          <Button onClick={() => navigate("/dashboard")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (conversation === undefined) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (conversation === null) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <div>
            <p className="text-foreground font-medium mb-1">Conversation not found</p>
            <p className="text-sm text-muted-foreground">This conversation may have been deleted or doesn't exist.</p>
          </div>
          <Button onClick={() => navigate("/dashboard")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (conversation.status) {
      case "pending":
        return <PendingView conversationId={id} conversation={conversation} />;
      case "active":
        return <CurrentView conversationId={id} />;
      case "ended":
        return <CompletedView conversationId={id} conversation={conversation} />;
      default:
        return <PendingView conversationId={id} conversation={conversation} />;
    }
  };

  const getStatusColor = () => {
    switch (conversation.status) {
      case "active":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "ended":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "pending":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default:
        return "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20";
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col">
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
                Conversation
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                #{id.slice(0, 8)}
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
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
