import * as React from "react";
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
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
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