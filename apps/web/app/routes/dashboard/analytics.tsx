"use client";
import AnalyticsDashboard from "~/components/analytics/AnalyticsDashboard";

export default function AnalyticsPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-border bg-sidebar backdrop-blur-sm dark:bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Your Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Track your communication performance and growth over time
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto overflow-x-hidden custom-scrollbar">
        <div className="@container/main mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="flex flex-col gap-4 md:gap-6">
            <AnalyticsDashboard />
          </div>
        </div>
      </div>
    </div>
  );
}
