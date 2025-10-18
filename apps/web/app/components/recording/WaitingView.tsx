import { Users, Loader2 } from "lucide-react";

interface WaitingViewProps {
  conversationId: string;
}

export default function WaitingView({ conversationId }: WaitingViewProps) {
  return (
    <div className="w-full max-w-md space-y-6">
      {/* Main Waiting Section */}
      <div className="bg-[#353E41] rounded-2xl p-8 flex flex-col items-center">
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
          </div>
        </div>

        <h2 className="text-xl font-medium mb-3">Transcription in Progress</h2>
        <p className="text-sm text-gray-300 text-center max-w-xs">
          The conversation is being recorded and transcribed on the other participant's device
        </p>
      </div>

      {/* Status Info */}
      <div className="bg-[#353E41] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">Status</span>
          </div>
          <span className="text-sm text-blue-400">Active</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 flex items-center justify-center">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            </div>
            <span className="text-sm text-gray-300">Recording</span>
          </div>
          <span className="text-sm text-white">On other device</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-center space-y-2">
        <p className="text-sm text-gray-400">
          You'll receive the conversation insights and summary automatically once the recording is complete
        </p>
        <p className="text-xs text-gray-500">
          Please wait while the other participant manages the recording
        </p>
      </div>
    </div>
  );
}
