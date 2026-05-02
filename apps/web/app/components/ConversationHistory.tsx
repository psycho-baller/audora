import { api } from "@audora/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { ChevronRight, Clock, Inbox } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { getConversationDisplayTitle } from "~/lib/conversation-context";

interface ConversationHistoryProps {
  className?: string;
  headerActions?: ReactNode;
  onScrollBack?: () => void;
}

export default function ConversationHistory({
  className = "",
  headerActions,
  onScrollBack,
}: ConversationHistoryProps) {
  const navigate = useNavigate();
  const conversations = useQuery(api.conversations.list);
  const allConversations = conversations || [];
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const totalPages = Math.max(1, Math.ceil(allConversations.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedConversations = allConversations.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

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
    return getConversationDisplayTitle(conv);
  };

  const getParticipantInitials = (name?: string) => {
    if (!name) {
      return "?";
    }

    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return "?";
    }

    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  };

  if (conversations === undefined) {
    return (
      <div className={`w-full space-y-5 ${className}`}>
        {headerActions ? (
          <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1" />
            <div className="flex w-full gap-2 lg:ml-auto lg:w-auto">
              {headerActions}
            </div>
          </div>
        ) : null}

        <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/40 px-4 py-12">
          <p className="text-sm text-muted-foreground">Loading conversations...</p>
        </div>
      </div>
    );
  }

  const showPagination = totalPages > 1;
  const showToolbar = showPagination || Boolean(headerActions);

  return (
    <div className={`w-full space-y-5 ${className}`}>
      {showToolbar ? (
        <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {showPagination ? (
              <>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}>
                    Previous
                  </Button>
                  <span className="min-w-20 text-center text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}>
                    Next
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Showing {startIndex + 1}-{Math.min(endIndex, allConversations.length)} of {allConversations.length} conversations
                </p>
              </>
            ) : null}
          </div>

          {headerActions ? (
            <div className="flex w-full gap-2 lg:ml-auto lg:w-auto">
              {headerActions}
            </div>
          ) : null}
        </div>
      ) : null}

      {allConversations.length === 0 ? (
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
        <div className="max-h-[50vh] overflow-y-auto pr-1 md:max-h-[34rem]">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {paginatedConversations.map((conversation) => (
              <div
                key={conversation._id}
                onClick={() => {
                  const route =
                    conversation.status === "ended"
                      ? `conversations/${conversation._id}`
                      : `record/${conversation._id}`;
                  navigate(route);
                }}
                className="group bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all duration-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center">
                    {conversation.participants.slice(0, 3).map((participant, index) => (
                      <Avatar
                        key={participant._id}
                        className={`size-9 border-2 border-card bg-muted ${index === 0 ? "" : "-ml-2"}`}>
                        <AvatarImage src={participant.image} alt={participant.name ?? "Participant"} />
                        <AvatarFallback className="text-[10px] font-medium text-foreground">
                          {getParticipantInitials(participant.name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {conversation.participantCount > 3 ? (
                      <div className="-ml-2 flex size-9 items-center justify-center rounded-full border-2 border-card bg-muted text-xs font-semibold text-muted-foreground">
                        +{conversation.participantCount - 3}
                      </div>
                    ) : null}
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
        </div>
      )}
    </div>
  );
}
