import * as React from "react";
import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { WaitlistSuccessDialog } from "./waitlist-success-dialog";

type WaitlistInputProps = {
  className?: string;
  onSubmit?: (email: string) => Promise<{ alreadyAdded?: boolean } | void>;
  busy?: boolean;
  joined?: boolean; // controlled flag
};

export function WaitlistInput({ className, onSubmit, busy, joined: joinedProp }: WaitlistInputProps) {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [joinedInternal, setJoinedInternal] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);

  const joined = joinedProp ?? joinedInternal;

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError("Use a valid email.");
      return;
    }

    try {
      setSubmitting(true);
      const result = await onSubmit?.(email.trim());

      if (result && result.alreadyAdded) {
        // Show message but do not mark as newly joined or open success dialog
        setError("That email is already on the waitlist.");
        setJoinedInternal(true); // optionally mark as joined so button disables
        return;
      }

      setJoinedInternal(true);
      setShowSuccess(true);
    } catch {
      setError("There was an issue with processing the request. Please try again.");
      setJoinedInternal(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cn("relative w-full max-w-md mx-auto", className)}>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        role="region"
        aria-label="Waitlist signup"
      >
        <div
          className={cn(
            "flex items-center gap-2 rounded-full px-3 py-2 border bg-muted/20",
            "border-border text-foreground transition-all duration-200",
            "hover:border-primary/50 focus-within:border-primary/50"
          )}
        >
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(
              "bg-transparent dark:bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm flex-1 shadow-none",
              "placeholder:text-muted-foreground/60"
            )}
            disabled={submitting || joined}
            aria-invalid={!!error}
            aria-describedby={error ? "email-error" : undefined}
            aria-label="Email address for waitlist"
          />
          <Button
            type="submit"
            size="lg"
            disabled={!isValidEmail(email) || submitting || busy || joined}
            className={cn(
              "rounded-full",
              "bg-primary text-primary-foreground hover:bg-primary/90 text-md",
              "transition-all"
            )}
          >
            {joined ? "Joined" : submitting ? "Joining..." : "Join"}
          </Button>
        </div>

        {error && (
          <p className="text-xs text-destructive text-center" role="alert">
            {error}
          </p>
        )}

        {!error && !joined && (
          <p className="text-xs text-muted-foreground text-center">
            Join the waitlist for early access
          </p>
        )}

        {joined && (
          <WaitlistSuccessDialog
            open={showSuccess}
            onOpenChange={setShowSuccess}
          />
        )}
      </form>
    </div>
  );
}