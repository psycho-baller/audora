interface AnalyticsPanelProps {
  showHeader?: boolean;
  className?: string;
}

export function AnalyticsPanel({ showHeader = true, className }: AnalyticsPanelProps) {
  return (
    <div className={className}>
      {showHeader && (
        <h2 className="text-lg font-semibold text-foreground mb-4">Analytics</h2>
      )}
      <p className="text-sm text-muted-foreground text-center py-8">
        Analytics dashboard will be implemented in Part 4
      </p>
      <div className="space-y-4 mt-4">
        <div className="bg-muted/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Coming soon:</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            <li>• Communication Scores (Clarity, Conciseness, Confidence)</li>
            <li>• Filler Word Detection</li>
            <li>• Speaking Pace Analysis</li>
            <li>• Word Choice Insights</li>
            <li>• AI Coaching Feedback</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
