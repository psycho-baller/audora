"use client";

import { api } from "@audora/backend/convex/_generated/api";
import { useAuth } from "@clerk/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export default function TestProcessTranscriptPage() {
  const { isSignedIn } = useAuth();
  const createMacConversation = useMutation(api.conversations.createMacConversation);
  const processRealtimeTranscript = useAction(api.realtimeTranscription.processRealtimeTranscript);
  
  const [title, setTitle] = useState("Test Single-User Conversation");
  const [initiatorName, setInitiatorName] = useState("Me");
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch the created conversation and transcript to verify
  const conversation = useQuery(
    api.conversations.get,
    conversationId ? { id: conversationId as any } : "skip"
  );
  const transcript = useQuery(
    api.conversations.getTranscript,
    conversationId ? { conversationId: conversationId as any } : "skip"
  );
  const facts = useQuery(
    api.conversations.getFacts,
    conversationId ? { conversationId: conversationId as any } : "skip"
  );

  if (!isSignedIn) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to test the action.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Sample single-user transcript data (S1 only, simulating Mac app recording)
  const sampleTranscriptTurns = [
    {
      speaker: "S1",
      text: "Hello, this is a test conversation.",
      startTime: 0,
      endTime: 2000,
      words: [
        { word: "Hello", startTime: 0, endTime: 500 },
        { word: "this", startTime: 500, endTime: 800 },
        { word: "is", startTime: 800, endTime: 1000 },
        { word: "a", startTime: 1000, endTime: 1100 },
        { word: "test", startTime: 1100, endTime: 1500 },
        { word: "conversation", startTime: 1500, endTime: 2000 },
      ],
    },
    {
      speaker: "S1",
      text: "I'm testing the backend transcript processing.",
      startTime: 2500,
      endTime: 5000,
      words: [
        { word: "I'm", startTime: 2500, endTime: 2800 },
        { word: "testing", startTime: 2800, endTime: 3300 },
        { word: "the", startTime: 3300, endTime: 3500 },
        { word: "backend", startTime: 3500, endTime: 4000 },
        { word: "transcript", startTime: 4000, endTime: 4500 },
        { word: "processing", startTime: 4500, endTime: 5000 },
      ],
    },
    {
      speaker: "S1",
      text: "This should work with a single user conversation.",
      startTime: 5500,
      endTime: 8500,
      words: [
        { word: "This", startTime: 5500, endTime: 5800 },
        { word: "should", startTime: 5800, endTime: 6200 },
        { word: "work", startTime: 6200, endTime: 6500 },
        { word: "with", startTime: 6500, endTime: 6800 },
        { word: "a", startTime: 6800, endTime: 6900 },
        { word: "single", startTime: 6900, endTime: 7300 },
        { word: "user", startTime: 7300, endTime: 7700 },
        { word: "conversation", startTime: 7700, endTime: 8500 },
      ],
    },
  ];

  const handleTest = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      setResult(null);
      setConversationId(null);

      // Step 1: Create a Mac conversation
      console.log("Step 1: Creating Mac conversation...");
      const conversation = await createMacConversation({
        title: title || undefined,
      });
      console.log("✅ Conversation created:", conversation);
      setConversationId(conversation.id);

      // Step 2: Process transcript with single-user data
      console.log("Step 2: Processing transcript...");
      const processResult = await processRealtimeTranscript({
        conversationId: conversation.id as any,
        transcriptTurns: sampleTranscriptTurns,
        initiatorName: initiatorName || "Me",
        scannerName: "System", // For Mac app, scanner is system audio
      });

      console.log("✅ Processing complete:", processResult);
      setResult(processResult);
    } catch (err: any) {
      const errorMessage = err?.message || "Unknown error occurred";
      setError(errorMessage);
      console.error("❌ Test failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Test processRealtimeTranscript (Single-User)</CardTitle>
          <CardDescription>
            Test the backend transcript processing with a single-user Mac app conversation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Conversation Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter conversation title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="initiatorName">Initiator Name</Label>
            <Input
              id="initiatorName"
              value={initiatorName}
              onChange={(e) => setInitiatorName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="p-4 bg-muted rounded-md">
            <Label className="text-sm font-semibold mb-2 block">
              Sample Transcript (Single-User - S1 only):
            </Label>
            <pre className="font-mono text-xs h-40 overflow-auto bg-background p-2 rounded border">
              {JSON.stringify(sampleTranscriptTurns, null, 2)}
            </pre>
          </div>

          <Button
            onClick={handleTest}
            disabled={isProcessing}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Test processRealtimeTranscript"
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
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-3">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-semibold">Processing Complete!</span>
                </div>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>S1 Facts:</strong> {result.S1_facts?.length || 0} facts extracted
                  </p>
                  <p>
                    <strong>S2 Facts:</strong> {result.S2_facts?.length || 0} facts extracted
                  </p>
                  <p>
                    <strong>Transcript Turns:</strong> {result.transcript?.length || 0} turns
                  </p>
                </div>
              </div>

              {conversation && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <h3 className="font-semibold mb-2">Conversation Details:</h3>
                  <div className="space-y-1 text-sm">
                    <p>
                      <strong>ID:</strong> {conversation._id}
                    </p>
                    <p>
                      <strong>Status:</strong> {conversation.status}
                    </p>
                    <p>
                      <strong>Initiator:</strong> {conversation.initiatorUserId}
                    </p>
                    <p>
                      <strong>Scanner:</strong>{" "}
                      {conversation.scannerUserId || "None (single-user) ✅"}
                    </p>
                    {conversation.location && (
                      <p>
                        <strong>Location:</strong> {conversation.location}
                      </p>
                    )}
                    {conversation.summary && (
                      <p>
                        <strong>Summary:</strong> {conversation.summary}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {transcript && transcript.length > 0 && (
                <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-md">
                  <h3 className="font-semibold mb-2">
                    Transcript Turns ({transcript.length}):
                  </h3>
                  <div className="space-y-2 text-sm max-h-60 overflow-y-auto">
                    {transcript.map((turn, idx) => (
                      <div key={idx} className="p-2 bg-white dark:bg-gray-900 rounded">
                        <p>
                          <strong>Turn {turn.order}:</strong> {turn.text}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          User ID: {turn.userId} | Words: {turn.words?.length || 0}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {facts && facts.length > 0 && (
                <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-md">
                  <h3 className="font-semibold mb-2">Extracted Facts:</h3>
                  <div className="space-y-2 text-sm">
                    {facts.map((factGroup, idx) => (
                      <div key={idx} className="p-2 bg-white dark:bg-gray-900 rounded">
                        <p className="font-semibold">User: {factGroup.userId}</p>
                        <ul className="list-disc list-inside mt-1">
                          {factGroup.facts.map((fact, factIdx) => (
                            <li key={factIdx}>{fact}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
