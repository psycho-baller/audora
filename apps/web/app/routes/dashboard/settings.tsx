"use client";
import { useState } from "react";
import { api } from "@audora/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import SubscriptionStatus from "~/components/subscription-status";
import ConnectionGraph from "~/components/network/ConnectionGraph";
import { ThemeToggle } from "~/components/ThemeToggle";

export default function Page() {
  const [activeTab, setActiveTab] = useState<"profile" | "network" | "subscription">("profile");
  const [copied, setCopied] = useState(false);
  const currentUser = useQuery(api.users.getCurrentUser);
  const usersInvitedByMe = useQuery(
    api.users.getUsersInvitedBy,
    currentUser?.inviteCode ? { code: currentUser.inviteCode } : "skip"
  );

  const handleCopyCode = () => {
    if (currentUser?.inviteCode) {
      navigator.clipboard.writeText(currentUser.inviteCode);
      setCopied(true);
      toast.success("Invite code copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (currentUser?.inviteCode) {
      const link = `${window.location.origin}/invite/${currentUser.inviteCode}`;
      navigator.clipboard.writeText(link);
      toast.success("Invite link copied!");
    }
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
      <div className="@container/main flex min-h-full flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6 border-b border-border">
              <button
                onClick={() => setActiveTab("profile")}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === "profile"
                    ? "text-blue-500 border-b-2 border-blue-500"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveTab("network")}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === "network"
                    ? "text-blue-500 border-b-2 border-blue-500"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                Network
              </button>
              <button
                onClick={() => setActiveTab("subscription")}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === "subscription"
                    ? "text-blue-500 border-b-2 border-blue-500"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                Subscription
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Profile Settings</h2>
                  <p className="text-muted-foreground">Manage your profile information here.</p>
                </div>

                {/* Appearance Section */}
                <div className="bg-card rounded-lg p-6 border border-border">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">Appearance</h3>
                      <p className="text-muted-foreground">
                        Switch between light and dark mode.
                      </p>
                    </div>
                    <ThemeToggle />
                  </div>
                </div>

                {/* Invite Code Section */}
                <div className="bg-card rounded-lg p-6 border border-border">
                  <h3 className="text-xl font-semibold text-foreground mb-2">Your Invite Code</h3>
                  <p className="text-muted-foreground mb-4">
                    Share your unique code with others to give them access to the platform.
                  </p>
                  
                  {currentUser?.inviteCode ? (
                    <div className="space-y-4">
                      {/* Code Display */}
                      <div className="flex items-center gap-3">
                        <div className="bg-secondary px-6 py-3 rounded-lg border border-border">
                          <span className="text-3xl font-mono font-bold text-primary tracking-wider">
                            {currentUser.inviteCode}
                          </span>
                        </div>
                        <button
                          onClick={handleCopyCode}
                          className="p-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
                          title="Copy code"
                        >
                          {copied ? (
                            <Check className="w-5 h-5 text-white" />
                          ) : (
                            <Copy className="w-5 h-5 text-white" />
                          )}
                        </button>
                      </div>

                      {/* Shareable Link */}
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Shareable Link</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={`${window.location.origin}/invite/${currentUser.inviteCode}`}
                            className="flex-1 bg-secondary border border-border rounded-lg px-4 py-2 text-foreground text-sm font-mono"
                          />
                          <button
                            onClick={handleCopyLink}
                            className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-secondary-foreground text-sm font-medium"
                          >
                            Copy Link
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">Loading your invite code...</div>
                  )}
                </div>

                {/* Referral Stats Section */}
                <div className="bg-card rounded-lg p-6 border border-border">
                  <h3 className="text-xl font-semibold text-foreground mb-2">Referral Stats</h3>
                  <p className="text-muted-foreground mb-4">
                    Track who you've invited to the platform.
                  </p>
                  
                  {currentUser?.invitedByCode && (
                    <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                      <p className="text-sm text-primary">
                        You were invited by code: <span className="font-mono font-bold">{currentUser.invitedByCode}</span>
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                      <span className="text-foreground">Users you've invited:</span>
                      <span className="text-2xl font-bold text-primary">
                        {usersInvitedByMe?.length || 0}
                      </span>
                    </div>
                    
                    {usersInvitedByMe && usersInvitedByMe.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground mb-2">Recent invites:</p>
                        <div className="space-y-1">
                          {usersInvitedByMe.slice(0, 5).map((user) => (
                            <div key={user._id} className="text-sm text-muted-foreground p-2 bg-secondary rounded">
                              {user.name || user.email || "Anonymous"}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "network" && (
              <div className="space-y-4">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-foreground mb-2">Your Connection Network</h2>
                  <p className="text-muted-foreground">
                    Discover how you're connected with others based on shared interests and topics
                    from your conversations.
                  </p>
                </div>
                {/* <ConnectionGraph /> */}
              </div>
            )}

            {activeTab === "subscription" && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-foreground mb-4">Subscription</h2>
                <SubscriptionStatus />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
