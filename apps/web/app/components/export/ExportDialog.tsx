import { api } from "@audora/backend/convex/_generated/api";
import type { Id } from "@audora/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { Download, FileText, FileJson, Share2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

interface ExportDialogProps {
  conversationId: Id<"conversations">;
  trigger?: React.ReactNode;
}

export function ExportDialog({ conversationId, trigger }: ExportDialogProps) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const conversation = useQuery(api.conversations.get, { id: conversationId });
  const transcript = useQuery(api.conversations.getTranscript, { conversationId });
  const speakers = useQuery(api.conversations.getSpeakers, { conversationId });
  const currentUser = useQuery(api.users.getCurrentUser);
  const analytics = useQuery(
    api.analytics.getAnalytics,
    currentUser && conversationId
      ? { conversationId, userId: currentUser._id }
      : "skip"
  );
  
  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleExportText = () => {
    if (!transcript || !speakers) return;
    
    let content = `Conversation Transcript\n`;
    content += `Date: ${new Date(conversation?._creationTime || Date.now()).toLocaleDateString()}\n`;
    content += `Location: ${conversation?.location || "N/A"}\n`;
    content += `\n${"=".repeat(50)}\n\n`;
    
    transcript.forEach((turn) => {
      const speakerName = turn.userId && speakers[turn.userId]
        ? speakers[turn.userId].name
        : turn.speaker || "Unknown Speaker";
      content += `${speakerName}: ${turn.text}\n\n`;
    });
    
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${conversationId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleExportJSON = () => {
    if (!transcript || !speakers || !analytics) return;
    
    const exportData = {
      conversation: {
        id: conversationId,
        date: conversation?._creationTime,
        location: conversation?.location,
        duration: conversation?.startedAt && conversation?.endedAt
          ? conversation.endedAt - conversation.startedAt
          : null,
      },
      speakers: speakers,
      transcript: transcript.map((turn) => ({
        speaker: turn.userId && speakers[turn.userId]
          ? speakers[turn.userId].name
          : turn.speaker || "Unknown",
        text: turn.text,
        timestamp: turn.timestamp,
        words: turn.words,
      })),
      analytics: {
        fillerWords: analytics.fillerWords,
        pacing: analytics.pacing,
        scores: analytics.scores,
        weakWords: analytics.weakWords,
        repetitions: analytics.repetitions,
        sentenceStarters: analytics.sentenceStarters,
      },
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${conversationId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleExportAnalyticsReport = () => {
    if (!analytics || !conversation) return;
    
    let content = `Speech Analytics Report\n`;
    content += `Date: ${new Date(conversation._creationTime).toLocaleDateString()}\n`;
    content += `Location: ${conversation.location || "N/A"}\n`;
    content += `\n${"=".repeat(50)}\n\n`;
    
    content += `OVERALL SCORES\n`;
    content += `Clarity: ${analytics.scores.clarity}/100\n`;
    content += `Conciseness: ${analytics.scores.conciseness}/100\n`;
    content += `Confidence: ${analytics.scores.confidence}/100\n\n`;
    
    content += `DELIVERY METRICS\n`;
    content += `Speaking Pace: ${analytics.pacing.wordsPerMinute} words/minute\n`;
    content += `Filler Words: ${analytics.fillerWords.count} (${analytics.fillerWords.ratePerMinute.toFixed(1)} per minute)\n\n`;
    
    if (analytics.weakWords.length > 0) {
      content += `WEAK WORDS (${analytics.weakWords.length})\n`;
      analytics.weakWords.forEach((ww, i) => {
        content += `${i + 1}. "${ww.word}" in "${ww.sentence}"\n`;
        if (ww.suggestion) {
          content += `   Suggestion: ${ww.suggestion}\n`;
        }
      });
      content += `\n`;
    }
    
    if (analytics.repetitions.repeatedWords.length > 0) {
      content += `REPEATED WORDS\n`;
      analytics.repetitions.repeatedWords.slice(0, 10).forEach((rw) => {
        content += `- "${rw.word}": ${rw.count} times\n`;
      });
      content += `\n`;
    }
    
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-report-${conversationId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="w-4 h-4" />
            Share & Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share & Export</DialogTitle>
          <DialogDescription>
            Share this conversation or export the data in various formats
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Share Link */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Share Link</h4>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="flex-1 justify-start gap-2"
                onClick={handleCopyLink}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Link</span>
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {/* Export Options */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Export Data</h4>
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={handleExportText}
                disabled={!transcript}
              >
                <FileText className="w-4 h-4" />
                <span>Export Transcript (.txt)</span>
              </Button>
              
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={handleExportJSON}
                disabled={!transcript || !analytics}
              >
                <FileJson className="w-4 h-4" />
                <span>Export Full Data (.json)</span>
              </Button>
              
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={handleExportAnalyticsReport}
                disabled={!analytics}
              >
                <Download className="w-4 h-4" />
                <span>Export Analytics Report (.txt)</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
