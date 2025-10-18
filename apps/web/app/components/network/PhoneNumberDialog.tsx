import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Loader2, Phone } from "lucide-react";

interface PhoneNumberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  onSubmit: (phoneNumber: string) => Promise<void>;
}

export function PhoneNumberDialog({
  open,
  onOpenChange,
  contactName,
  onSubmit,
}: PhoneNumberDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits
    const value = e.target.value.replace(/\D/g, "");
    // Limit to 10 digits
    setPhoneNumber(value.slice(0, 10));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (phoneNumber.length !== 10) {
      setError("Please enter exactly 10 digits");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // Add +1 prefix when submitting
      await onSubmit(`+1${phoneNumber}`);
      onOpenChange(false);
      setPhoneNumber("");
    } catch (err: any) {
      setError(err.message || "Failed to initiate call. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setPhoneNumber("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Call {contactName}
          </DialogTitle>
          <DialogDescription>
            Enter the phone number to call. Only US and Canadian numbers are supported.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">+1</span>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="5551234567"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  disabled={isSubmitting}
                  autoFocus
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter 10 digits (US/Canada only)
              </p>
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || phoneNumber.length !== 10}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Calling...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 mr-2" />
                  Call Now
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
