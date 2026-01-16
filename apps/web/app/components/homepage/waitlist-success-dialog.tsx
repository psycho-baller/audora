import * as React from "react";
import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  onClose?: () => void;
};

export function WaitlistSuccessDialog({
  open,
  onOpenChange,
  trigger,
  onClose,
}: Props) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internalOpen;
  const surveyUrl = "https://app.formbricks.com/s/cmikz8vnu8hxlad01g9gp707t";
  const surveyButtonRef = React.useRef<HTMLAnchorElement>(null);
  const [isHoveringClose, setIsHoveringClose] = React.useState(false);

  const setOpen = (next: boolean) => {
    if (controlled) onOpenChange?.(next);
    else setInternalOpen(next);
    if (!next) onClose?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          surveyButtonRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>You're officially on the waitlist!</DialogTitle>
          <DialogDescription>
            As an early supporter, you can unlock 50% off the Pro plan by completing our survey.
            Your feedback genuinely helps us build a better Audora for you.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <div className="relative">
            <span
              className={cn(
                "absolute -top-8 w-full text-center text-sm font-bold text-muted-foreground transition-all duration-200 ease-out pointer-events-none",
                isHoveringClose
                  ? "opacity-100 translate-y-0 scale-100"
                  : "opacity-0 translate-y-2 scale-90"
              )}
            >
              Sike!🫣
            </span>
            <Button
              variant={isHoveringClose ? "default" : "outline"}
              onClick={() => {
                if (isHoveringClose) {
                  window.open(surveyUrl, "_blank", "noopener,noreferrer");
                } else {
                  setOpen(false);
                }
              }}
              onMouseEnter={() => setIsHoveringClose(true)}
              onMouseLeave={() => setIsHoveringClose(false)}
              className="w-full sm:w-auto transition-all duration-200"
            >
              {isHoveringClose ? "Take the survey" : "Close"}
            </Button>
          </div>
          <Button asChild>
            <a
              ref={surveyButtonRef}
              href={surveyUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Take the survey
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}