"use client";

import { api } from "@audora/backend/convex/_generated/api";
import type { Id } from "@audora/backend/convex/_generated/dataModel";
import { useAuth, useUser } from "@clerk/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  FolderOpen,
  Loader2,
  Mic,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { useSearchParams } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { getConversationDisplayTitle } from "~/lib/conversation-context";
import { cn } from "~/lib/utils";

const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_URL!.replace(
  /.cloud$/,
  ".site"
);

const SUGGESTED_PROMPTS = [
  "Analyze my tone this week",
  "Weak areas I should focus on?",
  "Help me prepare for my pitch",
];

const GENERAL_THREAD_KEY = "general";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatConversation {
  _id: string;
  _creationTime: number;
  status: "pending" | "active" | "ended";
  participants: Array<{
    _id: string;
    name?: string;
    image?: string;
  }>;
  participantCount: number;
}

function buildChatThreadKey(conversationIds: string[]) {
  if (conversationIds.length === 0) {
    return GENERAL_THREAD_KEY;
  }

  const sortedIds = [...conversationIds].sort();

  if (sortedIds.length === 1) {
    return `conversation:${sortedIds[0]}`;
  }

  return `multi:${sortedIds.join("|")}`;
}

function parseChatThreadKey(threadKey: string) {
  if (!threadKey || threadKey === GENERAL_THREAD_KEY) {
    return [];
  }

  if (threadKey.startsWith("conversation:")) {
    const conversationId = threadKey.slice("conversation:".length);
    return conversationId ? [conversationId] : [];
  }

  if (threadKey.startsWith("multi:")) {
    return threadKey
      .slice("multi:".length)
      .split("|")
      .filter(Boolean);
  }

  return [];
}

export default function Chat() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversations = (useQuery(api.conversations.list) ?? []) as ChatConversation[];
  const saveMessage = useMutation(api.chat.saveMessage);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [draftSelectedConversationIds, setDraftSelectedConversationIds] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeThreadKey = searchParams.get("thread") ?? GENERAL_THREAD_KEY;
  const selectedConversationIds = parseChatThreadKey(activeThreadKey);
  const chatHistory = useQuery(api.chat.getMessages, { threadKey: activeThreadKey });

  const firstName =
    user?.firstName ||
    user?.fullName?.split(" ")[0] ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "there";

  const linkedConversations = conversations.filter((conversation) =>
    selectedConversationIds.includes(conversation._id)
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setMessages([]);
  }, [activeThreadKey]);

  useEffect(() => {
    if (chatHistory === undefined || isLoading) {
      return;
    }

    setMessages(
      chatHistory.map((message) => ({
        id: message._id,
        role: message.role as "user" | "assistant",
        content: message.content,
      }))
    );
  }, [chatHistory, isLoading]);

  const setActiveThread = (threadKey: string) => {
    const normalizedThreadKey = threadKey || GENERAL_THREAD_KEY;
    const nextParams = new URLSearchParams(searchParams);

    if (normalizedThreadKey === GENERAL_THREAD_KEY) {
      nextParams.delete("thread");
    } else {
      nextParams.set("thread", normalizedThreadKey);
    }

    setSearchParams(nextParams);
  };

  const openConversationPicker = () => {
    setDraftSelectedConversationIds(selectedConversationIds);
    setIsPickerOpen(true);
  };

  const toggleDraftConversation = (conversationId: string) => {
    setDraftSelectedConversationIds((current) =>
      current.includes(conversationId)
        ? current.filter((id) => id !== conversationId)
        : [...current, conversationId]
    );
  };

  const applyConversationSelection = () => {
    setActiveThread(buildChatThreadKey(draftSelectedConversationIds));
    setIsPickerOpen(false);
  };

  const removeLinkedConversation = (conversationId: string) => {
    setActiveThread(buildChatThreadKey(selectedConversationIds.filter((id) => id !== conversationId)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !isSignedIn) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
    };

    const apiMessages = [...messages, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput("");
    setIsLoading(true);

    const singleConversationId =
      selectedConversationIds.length === 1
        ? (selectedConversationIds[0] as Id<"conversations">)
        : undefined;
    const linkedConversationIds =
      selectedConversationIds.length > 1
        ? (selectedConversationIds as Id<"conversations">[])
        : undefined;

    saveMessage({
      conversationId: singleConversationId,
      linkedConversationIds,
      threadKey: activeThreadKey,
      role: "user",
      content: userInput,
    }).catch((error) => {
      console.error("Failed to save user message:", error);
    });

    const assistantMessageId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);

    try {
      const token = await getToken({ template: "convex" });

      if (!token) {
        throw new Error("Missing Convex auth token");
      }

      const response = await fetch(`${CONVEX_SITE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          messages: apiMessages,
          conversationIds: selectedConversationIds,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is empty");
      }

      const decoder = new TextDecoder();
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        assistantContent += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: assistantContent }
              : message
          )
        );
      }

      if (assistantContent) {
        saveMessage({
          conversationId: singleConversationId,
          linkedConversationIds,
          threadKey: activeThreadKey,
          role: "assistant",
          content: assistantContent,
        }).catch((error) => {
          console.error("Failed to save assistant message:", error);
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setMessages((prev) =>
        prev.map((chatMessage) =>
          chatMessage.id === assistantMessageId
            ? {
                ...chatMessage,
                content: `Sorry, the coach request failed. ${message}`,
              }
            : chatMessage
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const linkedButtonLabel =
    selectedConversationIds.length > 0
      ? `${selectedConversationIds.length} conversation${selectedConversationIds.length === 1 ? "" : "s"} linked`
      : "Connect past conversations";

  return (
    <>
      <div className="flex h-[calc(100vh-4rem)] w-full flex-col overflow-hidden bg-background">
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-8 sm:px-6">
            <div className="w-full max-w-3xl space-y-8">
              <div className="flex flex-col items-center gap-5 text-center">
                <div className="inline-flex items-center gap-4 rounded-full px-5 py-3">
                  <AudoraMark />
                  <span className="text-4xl font-semibold tracking-tight text-foreground">
                    Audora
                  </span>
                </div>
              </div>

              <section className="mx-auto max-w-2xl space-y-4">
                <div className="space-y-1 text-left">
                  <p className="text-2xl text-muted-foreground">Hi {firstName}</p>
                  <h1 className="text-[2rem] font-medium tracking-tight text-foreground sm:text-[2.25rem]">
                    What&apos;s on your mind today?
                  </h1>
                </div>

                <CoachComposer
                  compact={false}
                  conversations={linkedConversations}
                  input={input}
                  inputRef={inputRef}
                  isLoading={isLoading}
                  onChange={setInput}
                  onOpenConversationPicker={openConversationPicker}
                  onPromptClick={(prompt) => {
                    setInput(prompt);
                    inputRef.current?.focus();
                  }}
                  onRemoveConversation={removeLinkedConversation}
                  onSubmit={handleSubmit}
                  pickerButtonLabel={linkedButtonLabel}
                />
              </section>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-border bg-card/50 backdrop-blur-sm">
              <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
                <AudoraMark compact />
                <div>
                  <h1 className="text-lg font-semibold text-foreground">Audora</h1>
                  <p className="text-sm text-muted-foreground">Communication coach</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
              <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
                <div className="space-y-6">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-3",
                        message.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                          <Sparkles className="size-5" />
                        </div>
                      ) : null}

                      <div
                        className={cn(
                          "max-w-[85%] rounded-3xl px-5 py-4 shadow-sm sm:max-w-[70%]",
                          message.role === "user"
                            ? "bg-[#6d63d9] text-white dark:bg-[#7a70eb]"
                            : "border border-border bg-card text-foreground"
                        )}
                      >
                        {message.role === "assistant" && !message.content.trim() ? (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        ) : (
                          <div
                            className={cn(
                              "prose prose-sm max-w-none",
                              message.role === "user"
                                ? "prose-invert"
                                : "prose-foreground dark:prose-invert",
                              "prose-p:my-1 prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2",
                              "prose-headings:mt-3 prose-headings:mb-2"
                            )}
                          >
                            <Markdown>{message.content}</Markdown>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>

            <div className="border-t border-border bg-card/50 px-4 py-4 backdrop-blur-sm sm:px-6">
              <div className="mx-auto w-full max-w-5xl">
                <CoachComposer
                  compact
                  conversations={linkedConversations}
                  input={input}
                  inputRef={inputRef}
                  isLoading={isLoading}
                  onChange={setInput}
                  onOpenConversationPicker={openConversationPicker}
                  onRemoveConversation={removeLinkedConversation}
                  onSubmit={handleSubmit}
                  pickerButtonLabel={linkedButtonLabel}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <DialogContent className="max-w-2xl border-border bg-card p-0">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle className="text-foreground">Connect past conversations</DialogTitle>
            <DialogDescription>
              Link specific conversations so Audora can focus the coaching on those exchanges.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] space-y-3 overflow-y-auto px-6 py-5">
            {conversations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                No conversations available to link yet.
              </div>
            ) : (
              conversations.map((conversation) => {
                const checked = draftSelectedConversationIds.includes(conversation._id);

                return (
                  <label
                    key={conversation._id}
                    className={cn(
                      "flex cursor-pointer items-start gap-4 rounded-2xl border px-4 py-4 transition-colors",
                      checked
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleDraftConversation(conversation._id)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {getConversationDisplayTitle(conversation)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatConversationDate(conversation._creationTime)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center">
                          {conversation.participants.slice(0, 3).map((participant, index) => (
                            <Avatar
                              key={participant._id}
                              className={cn(
                                "size-8 border-2 border-card bg-muted shadow-sm",
                                index === 0 ? "" : "-ml-2"
                              )}
                            >
                              <AvatarImage src={participant.image} alt={participant.name ?? "Participant"} />
                              <AvatarFallback className="text-[10px] font-medium text-foreground">
                                {getParticipantInitials(participant.name)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {conversation.participantCount > 3 ? (
                            <div className="-ml-2 flex size-8 items-center justify-center rounded-full border-2 border-card bg-muted text-[11px] font-semibold text-muted-foreground shadow-sm">
                              +{conversation.participantCount - 3}
                            </div>
                          ) : null}
                        </div>

                        <span className="text-xs text-muted-foreground">
                          {conversation.status === "ended" ? "Completed" : "In progress"}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDraftSelectedConversationIds([])}
            >
              Clear all
            </Button>
            <Button type="button" onClick={applyConversationSelection}>
              Link {draftSelectedConversationIds.length > 0 ? `${draftSelectedConversationIds.length} conversation${draftSelectedConversationIds.length === 1 ? "" : "s"}` : "conversations"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CoachComposer({
  compact = false,
  conversations,
  input,
  inputRef,
  isLoading,
  onChange,
  onOpenConversationPicker,
  onPromptClick,
  onRemoveConversation,
  onSubmit,
  pickerButtonLabel,
}: {
  compact?: boolean;
  conversations: ChatConversation[];
  input: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isLoading: boolean;
  onChange: (value: string) => void;
  onOpenConversationPicker: () => void;
  onPromptClick?: (value: string) => void;
  onRemoveConversation: (conversationId: string) => void;
  onSubmit: (e: React.FormEvent) => Promise<void> | void;
  pickerButtonLabel: string;
}) {
  return (
    <div className="space-y-3">
      {compact || conversations.length >= 0 ? (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max items-center gap-2">
              {conversations.map((conversation) => (
                <LinkedConversationChip
                  key={conversation._id}
                  conversation={conversation}
                  onRemove={() => onRemoveConversation(conversation._id)}
                />
              ))}
            </div>
          </div>

          {compact ? (
            <div className="flex h-11 shrink-0 items-center text-sm font-medium text-black dark:text-white">
              {pickerButtonLabel}
            </div>
          ) : (
            <Button
              type="button"
              onClick={onOpenConversationPicker}
              className="h-11 shrink-0 rounded-xl"
            >
              <FolderOpen className="size-4" />
              {pickerButtonLabel}
            </Button>
          )}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card/50 p-3 shadow-sm">
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ask Audora"
            disabled={isLoading}
            className="h-12 rounded-none border-0 bg-transparent px-3 text-base text-foreground shadow-none dark:bg-transparent focus-visible:ring-0"
          />
          <button
            type="button"
            disabled
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground opacity-70"
            aria-label="Voice input coming soon"
          >
            <Mic className="size-5" />
          </button>
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
            className="size-10 rounded-full"
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      </div>

      {!compact && onPromptClick ? (
        <div className="flex flex-wrap gap-3">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onPromptClick(prompt)}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LinkedConversationChip({
  conversation,
  onRemove,
}: {
  conversation: ChatConversation;
  onRemove: () => void;
}) {
  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
      <div className="flex items-center">
        {conversation.participants.slice(0, 2).map((participant, index) => (
          <Avatar
            key={participant._id}
            className={cn(
              "size-6 border border-card bg-muted",
              index === 0 ? "" : "-ml-1.5"
            )}
          >
            <AvatarImage src={participant.image} alt={participant.name ?? "Participant"} />
            <AvatarFallback className="text-[9px] font-medium text-foreground">
              {getParticipantInitials(participant.name)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span className="truncate">{formatConversationDate(conversation._creationTime)}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        aria-label="Remove linked conversation"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function AudoraMark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "grid place-items-end rounded-2xl bg-primary/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
        compact ? "size-11 p-2" : "size-14 p-2.5"
      )}
    >
      <div className="flex h-full w-full items-end gap-1">
        {[0.4, 0.7, 1, 0.8, 0.55].map((height, index) => (
          <span
            key={index}
            className="flex-1 rounded-full bg-primary"
            style={{ height: `${height * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function formatConversationDate(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today, ${date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  if (diffDays === 1) {
    return `Yesterday, ${date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getParticipantInitials(name?: string) {
  if (!name) {
    return "?";
  }

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
