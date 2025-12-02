import * as React from "react";
import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { WaitlistSuccessDialog } from "./waitlist-success-dialog";

type WaitlistInputProps = {
  className?: string;
  onSubmit?: (email: string) => Promise<void> | void;
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
      await onSubmit?.(email.trim());
      setJoinedInternal(true);
      setShowSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Failed. Try again.");
      setJoinedInternal(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cn("relative w-full max-w-md mx-auto", className)}>
      <div
        className={cn(
          "absolute inset-0 -m-2 rounded-3xl blur-lg opacity-0 transition-opacity pointer-events-none",
          "bg-[radial-gradient(closest-side,rgba(56,189,248,0.18),rgba(56,189,248,0))]"
        )}
      />
      <div
        className={cn(
          "group relative rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6 shadow-md transition-all",
          "hover:shadow-[0_12px_60px_0_rgba(56,189,248,0.20),0_0_1px_1px_rgba(56,189,248,0.15)]",
          "hover:border-primary/40"
        )}
      >
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          role="region"
          aria-label="Waitlist signup"
        >
          <div
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 border bg-background/40",
              "border-border text-foreground transition-all duration-200",
              "group-hover:border-primary/40"
            )}
          >
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(
                "bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm flex-1",
                "placeholder:text-muted-foreground/70"
              )}
              disabled={submitting || joined}
              aria-invalid={!!error}
              aria-describedBy={error ? "email-error" : undefined}
              aria-label="Email address for waitlist"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!isValidEmail(email) || submitting || busy || joined}
              className={cn(
                "rounded-full",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "shadow transition-all",
                "hover:shadow-[0_0_24px_4px_rgba(56,189,248,0.30)]",
                "group-hover:shadow-[0_0_24px_4px_rgba(56,189,248,0.30)]"
              )}
            >
              {joined ? "Joined" : submitting ? "Joining..." : "Join"}
            </Button>
          </div>

          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          {!error && !joined && (
            <p className="text-xs text-muted-foreground text-center">
              Enter your email to get started
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
    </div>
  );
}