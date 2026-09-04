import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, Mic, Lock } from "lucide-react";

interface VoiceConsentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConsentGiven: () => void;
}

export const VOICE_CONSENT_STORAGE_KEY = "tayari_voice_coach_consent_v1";

export function VoiceConsentModal({
  open,
  onOpenChange,
  onConsentGiven,
}: VoiceConsentModalProps) {
  const [agreed, setAgreed] = useState(false);

  // Reset checkbox state every time the dialog opens so a previous dismiss
  // cannot bypass consent on re-open.
  React.useEffect(() => {
    if (open) setAgreed(false);
  }, [open]);

  const handleConfirm = () => {
    if (!agreed) return;
    try {
      sessionStorage.setItem(VOICE_CONSENT_STORAGE_KEY, "true");
    } catch {
      // Best-effort storage
    }
    onConsentGiven();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader className="space-y-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
            <Mic className="w-5 h-5" />
          </div>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            AI Voice Coach Consent
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Practice interview delivery with real-time speech-to-text analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="p-3 bg-muted/40 rounded-lg border border-border/60 space-y-2">
            <div className="flex items-start gap-2 text-foreground font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>Zero Permanent Retention Safeguard</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Audio is discarded immediately after transcript generation. Raw audio is never stored permanently on any server or used to train shared AI models.
            </p>
          </div>

          <div className="p-3 bg-muted/20 rounded-lg border border-border/40 flex items-start gap-2 text-muted-foreground">
            <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>Transcripts and telemetry remain scoped to your verified account only.</span>
          </div>

          <div className="flex items-start space-x-2 pt-2 border-t border-border/40">
            <Checkbox
              id="voice-consent"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              className="mt-0.5"
            />
            <label
              htmlFor="voice-consent"
              className="text-xs font-medium text-foreground cursor-pointer select-none leading-snug"
            >
              I agree to practice with the AI voice coach. Audio is not stored permanently.
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!agreed}
            className="bg-primary text-primary-foreground font-semibold"
          >
            Start Voice Practice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
