import { QRCodeSVG } from "qrcode.react";
import { Clock, Users } from "lucide-react";
import { useState, useEffect } from "react";

interface PendingViewProps {
  conversationId: string;
  conversation: any;
}

export default function PendingView({
  conversationId,
  conversation,
}: PendingViewProps) {
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    // Generate QR URL
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/join/${conversationId}?code=${conversation.inviteCode}`;
    setQrUrl(url);
  }, [conversationId, conversation.inviteCode]);

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* QR Code Section */}
      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center shadow-lg">
        <h2 className="text-lg font-semibold text-foreground mb-4">Waiting for Participant</h2>
        <p className="text-sm text-muted-foreground mb-6 text-center">
          Have your conversation partner scan this QR code to join and give consent
        </p>

        {qrUrl && (
          <div className="bg-white p-4 rounded-xl mb-4">
            <QRCodeSVG value={qrUrl} size={200} />
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p className="break-all">{qrUrl}</p>
          <p>Invite Code: <span className="font-mono font-bold text-foreground">{conversation.inviteCode}</span></p>
        </div>
      </div>

      {/* Status Info */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Status</span>
          </div>
          <span className="text-sm text-yellow-400">Pending</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Participants</span>
          </div>
          <span className="text-sm text-foreground">1 waiting</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Once your partner scans and confirms, recording will begin automatically
        </p>
        <p className="text-xs text-muted-foreground/70">
          Both parties must consent before any audio is saved
        </p>
      </div>
    </div>
  );
}
