"use client";
import { useState } from "react";
import SubscriptionStatus from "~/components/subscription-status";
import ConnectionGraph from "~/components/network/ConnectionGraph";

export default function Page() {
  const [activeTab, setActiveTab] = useState<"profile" | "network" | "subscription">("profile");

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6 border-b border-gray-700">
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
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white">Profile Settings</h2>
                <p className="text-gray-400">Manage your profile information here.</p>
                {/* Add profile settings components here */}
              </div>
            )}

            {activeTab === "network" && (
              <div className="space-y-4">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Your Connection Network</h2>
                  <p className="text-gray-400">
                    Discover how you're connected with others based on shared interests and topics
                    from your conversations.
                  </p>
                </div>
                {/* <ConnectionGraph /> */}
              </div>
            )}

            {activeTab === "subscription" && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white mb-4">Subscription</h2>
                <SubscriptionStatus />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
