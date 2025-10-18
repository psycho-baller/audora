"use client";
import AnalyticsDashboard from "~/components/analytics/AnalyticsDashboard";

export default function AnalyticsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-white mb-2">Your Analytics</h1>
              <p className="text-gray-400">
                Track your communication performance and growth over time
              </p>
            </div>
            <AnalyticsDashboard />
          </div>
        </div>
      </div>
    </div>
  );
}
