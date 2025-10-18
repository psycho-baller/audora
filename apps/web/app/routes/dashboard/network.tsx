"use client";

import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Loader2, Users, ArrowUpRight } from "lucide-react";

function formatRelativeTime(timestamp: number) {
  const differenceMs = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (differenceMs < minute) return "Just now";
  if (differenceMs < hour) {
    const minutes = Math.round(differenceMs / minute);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (differenceMs < day) {
    const hours = Math.round(differenceMs / hour);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (differenceMs < week) {
    const days = Math.round(differenceMs / day);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name?: string | null, email?: string | null) {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/);
    const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase());
    return initials.join("");
  }
  if (email) {
    return email.charAt(0).toUpperCase();
  }
  return "?";
}

function formatInteractions(count: number) {
  if (count <= 0) return "No exchanges yet";
  if (count === 1) return "1 exchange";
  return `${count} exchanges`;
}

export default function NetworkPage() {
  const navigate = useNavigate();
  const connections = useQuery(api.network.list);

  const isLoading = connections === undefined;
  const sortedConnections = useMemo(() => connections ?? [], [connections]);

  const handleOpenContact = (contactId: string) => {
    navigate(`/dashboard/network/${contactId}`);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Network</h1>
            <p className="text-sm text-muted-foreground">
              People you have connected with across your recorded conversations.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {isLoading ? (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading your network...</p>
            </div>
          ) : sortedConnections.length === 0 ? (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
              <div className="rounded-full bg-muted p-4">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">No connections yet</h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Once you complete conversations with other people, they will automatically show up here so you can jump back in instantly.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sortedConnections.map((connection) => {
                const displayName = connection.name || connection.email || "Unknown participant";
                const lastInteraction = formatRelativeTime(connection.lastInteractionAt);
                const transcriptsLabel = formatInteractions(connection.totalTurns);

                return (
                  <button
                    type="button"
                    key={connection.contactId}
                    onClick={() => handleOpenContact(connection.contactId)}
                    className="group flex flex-col gap-4 rounded-xl border border-border bg-card/60 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        {connection.image ? (
                          <AvatarImage src={connection.image} alt={displayName} />
                        ) : null}
                        <AvatarFallback className="text-sm font-medium">
                          {getInitials(connection.name, connection.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-foreground">
                            {displayName}
                          </span>
                          <Badge variant="secondary">
                            {connection.conversationCount} conversation{connection.conversationCount === 1 ? "" : "s"}
                          </Badge>
                        </div>
                        {connection.email ? (
                          <p className="text-sm text-muted-foreground">{connection.email}</p>
                        ) : null}
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="rounded-full border border-border/60 px-2 py-1 font-medium text-foreground/80">
                        {transcriptsLabel}
                      </span>
                      <span>Last interaction {lastInteraction}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
