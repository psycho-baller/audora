import { Loader2, Users } from "lucide-react";

interface WaitingViewProps {
  conversationId: string;
}

export default function WaitingView({ conversationId }: WaitingViewProps) {
  return (
    <div className="w-full max-w-md space-y-6">
      {/* Main Waiting Section */}
      <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="relative mb-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        </div>

        <h2 className="mb-3 text-xl font-medium text-foreground">Transcription in Progress</h2>
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          The conversation is being recorded and transcribed on the other participant's device
        </p>
      </div>

      {/* Status Info */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Status</span>
          </div>
          <span className="text-sm text-primary">Active</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex h-4 w-4 items-center justify-center">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            </div>
            <span className="text-sm text-muted-foreground">Recording</span>
          </div>
          <span className="text-sm text-foreground">On other device</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          You'll receive the conversation insights and summary automatically once the recording is complete
        </p>
        <p className="text-xs text-muted-foreground/70">
          Please wait while the other participant manages the recording
        </p>
      </div>
    </div>
  );
}
