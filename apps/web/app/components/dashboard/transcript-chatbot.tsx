import { api } from "@audora/backend/convex/_generated/api";
import type { Id } from "@audora/backend/convex/_generated/dataModel";
import { useAuth } from "@clerk/react-router";
import { useMutation, useQuery } from "convex/react";
import { ChevronUp, Loader2, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_URL!.replace(
  /.cloud$/,
  ".site"
);

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface TranscriptChatbotProps {
  conversationId: Id<"conversations">;
}

export function TranscriptChatbot({ conversationId }: TranscriptChatbotProps) {
  const { isSignedIn, getToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load existing chat history from Convex
  const chatHistory = useQuery(api.chat.getMessages, { conversationId });
  const saveMessage = useMutation(api.chat.saveMessage);

  // Load chat history into messages state when available
  useEffect(() => {
    if (chatHistory && !hasLoadedHistory) {
      if (chatHistory.length > 0) {
        const historyMessages: Message[] = chatHistory.map((msg) => ({
          id: msg._id,
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }));
        setMessages(historyMessages);
      }
      setHasLoadedHistory(true);
    }
  }, [chatHistory, hasLoadedHistory]);

  const scrollToBottom = () => {
    const container = messagesEndRef.current?.parentElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !isSignedIn) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
    };

    // Add user message to UI immediately
    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput("");
    setIsLoading(true);

    // Save user message to database (don't block on this)
    saveMessage({
      conversationId,
      role: "user",
      content: userInput,
    }).catch((error) => {
      console.error("Failed to save user message:", error);
    });

    // Prepare messages for API (convert to the format expected by the backend)
    const apiMessages = [...messages, userMessage].map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Create placeholder for assistant message
    const assistantMessageId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);

    try {
      // Get auth token for the HTTP request
      const token = await getToken({ template: "convex" });
      
      const response = await fetch(`${CONVEX_SITE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          messages: apiMessages,
          conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          assistantContent += chunk;

          // Update the assistant message with streamed content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: assistantContent }
                : msg
            )
          );
        }
      }

      // Save assistant message to database (don't block on this)
      if (assistantContent) {
        saveMessage({
          conversationId,
          role: "assistant",
          content: assistantContent,
        }).catch((error) => {
          console.error("Failed to save assistant message:", error);
        });
      }
    } catch (error) {
      console.error("Chat error:", error);
      // Update assistant message with error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: "Sorry, there was an error processing your request." }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  return (
    <>
      {/* Collapsed tab - always visible when closed */}
      {!isOpen && (
        <div
          onClick={() => setIsOpen(true)}
          className="absolute bottom-2 left-2 right-2 bg-background border border-border rounded-full shadow-lg cursor-pointer z-50 px-4 py-2 flex items-center justify-end hover:bg-muted/50 transition-all duration-300 ease-in-out"
        >
          <span className="text-sm text-muted-foreground mr-2">Ask about this conversation...</span>
          <ChevronUp className="w-4 h-4" />
        </div>
      )}

      {/* Expanded panel */}
      <div className={`absolute top-2 bottom-2 left-2 right-2 bg-background border border-border rounded-lg shadow-lg z-40 flex flex-col transition-all duration-300 ease-in-out ${
        isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-8 pointer-events-none'
      }`}>
        <div className="h-12 flex items-center justify-between px-4 shrink-0 border-b border-border">
          <span className="text-sm font-medium text-foreground">Conversation Assistant</span>
          <Button
            onClick={() => setIsOpen(false)}
            variant="ghost"
            size="icon"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pr-3 custom-scrollbar">
          {chatHistory === undefined ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">Ask me anything about this conversation!</p>
              <p className="text-xs mt-2 opacity-70">
                I can help with analytics, filler words, key points, and more.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    msg.content ? (
                      <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )
                  ) : (
                    <span className="text-sm">{msg.content}</span>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSendMessage} className="flex items-center gap-2 p-4 border-t">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your transcript..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </div>
    </>
  );
}