"use client";

import { api } from "@audora/backend/convex/_generated/api";
import { useAuth } from "@clerk/react-router";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export default function TestMacConversationPage() {
  const { isSignedIn } = useAuth();
  const createMacConversation = useMutation(api.conversations.createMacConversation);
  const [title, setTitle] = useState("");
  const [calendarEventId, setCalendarEventId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<{ id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch the created conversation to verify it
  const conversation = useQuery(
    api.conversations.get,
    result ? { id: result.id as any } : "skip"
  );

  if (!isSignedIn) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to test the mutation.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleTest = async () => {
    try {
      setIsCreating(true);
      setError(null);
      setResult(null);

      const mutationResult = await createMacConversation({
        title: title || undefined,
        calendarEventId: calendarEventId || undefined,
      });

      setResult(mutationResult);
      console.log("✅ Mutation successful:", mutationResult);
    } catch (err: any) {
      const errorMessage = err?.message || "Unknown error occurred";
      setError(errorMessage);
      console.error("❌ Mutation failed:", err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Test createMacConversation Mutation</CardTitle>
          <CardDescription>
            Test the new mutation for creating Mac app conversations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter conversation title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="calendarEventId">Calendar Event ID (optional)</Label>
            <Input
              id="calendarEventId"
              value={calendarEventId}
              onChange={(e) => setCalendarEventId(e.target.value)}
              placeholder="Enter calendar event ID"
            />
          </div>

          <Button
            onClick={handleTest}
            disabled={isCreating}
            className="w-full"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Conversation...
              </>
            ) : (
              "Test Mutation"
            )}
          </Button>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                <span className="font-semibold">Error:</span>
              </div>
              <p className="mt-2 text-sm">{error}</p>
            </div>
          )}

          {result && (
            <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <span className="font-semibold">Success!</span>
              </div>
              <div className="mt-2 space-y-1 text-sm">
                <p>
                  <strong>Conversation ID:</strong> {result.id}
                </p>
                {conversation && (
                  <>
                    <p>
                      <strong>Status:</strong> {conversation.status}
                    </p>
                    <p>
                      <strong>Initiator:</strong> {conversation.initiatorUserId}
                    </p>
                    {conversation.location && (
                      <p>
                        <strong>Location:</strong> {conversation.location}
                      </p>
                    )}
                    <p>
                      <strong>Started At:</strong>{" "}
                      {conversation.startedAt
                        ? new Date(conversation.startedAt).toLocaleString()
                        : "N/A"}
                    </p>
                    <p>
                      <strong>Scanner User ID:</strong>{" "}
                      {conversation.scannerUserId || "None (single-user conversation)"}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
