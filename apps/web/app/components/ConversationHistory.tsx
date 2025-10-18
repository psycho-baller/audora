import { MessageSquare, Clock, ChevronRight, Inbox } from "lucide-react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface ConversationHistoryProps {
  className?: string;
  onScrollBack?: () => void;
}

export default function ConversationHistory({
  className = "",
  onScrollBack,
}: ConversationHistoryProps) {
  const navigate = useNavigate();
  const conversations = useQuery(api.conversations.list) || [];

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today, ${date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`;
    } else if (diffDays === 1) {
      return `Yesterday, ${date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  const getConversationTitle = (conv: any) => {
    return conv.location || `Conversation ${conv._id.slice(0, 8)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
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
    <div className={`w-full ${className}`}>
      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="p-4 rounded-full bg-muted mb-4">
            <Inbox className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No conversations yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Start your first conversation by tapping the button below
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {conversations.map((conversation) => (
            <div
              key={conversation._id}
              onClick={() => navigate(`conversations/${conversation._id}`)}
              className="group bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all duration-200">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <MessageSquare className="w-4 h-4 text-primary" />
                  </div>
                  <div className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(conversation.status)}`}>
                    {conversation.status}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              
              <h3 className="text-sm font-semibold text-foreground mb-2 line-clamp-1">
                {getConversationTitle(conversation)}
              </h3>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{formatDate(conversation._creationTime)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
