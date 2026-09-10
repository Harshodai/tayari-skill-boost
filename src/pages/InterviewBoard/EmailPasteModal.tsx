import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseApplicationEmail } from "@/api";
import type { ParsedEmailData } from "./types";

export interface EmailPasteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveParsedEmail: (data: {
    title: string;
    company: string;
    location: string;
    stage: string;
    notes: string;
  }) => void;
}

export const EmailPasteModal: React.FC<EmailPasteModalProps> = ({
  open,
  onOpenChange,
  onSaveParsedEmail,
}) => {
  const [emailText, setEmailText] = useState("");
  const [isParsingEmail, setIsParsingEmail] = useState(false);
  const [parsedEmailData, setParsedEmailData] = useState<ParsedEmailData | null>(null);

  const handleParseEmailText = async () => {
    if (!emailText.trim() || emailText.length < 10) {
      toast.error("Please paste a longer email message (at least 10 characters).");
      return;
    }
    setIsParsingEmail(true);
    setParsedEmailData(null);
    try {
      const data = await parseApplicationEmail(emailText);
      setParsedEmailData(data);
      if (data && !data.is_job_related) {
        toast.warning("The AI suggests this email might not be related to a job application.");
      } else {
        toast.success("Email parsed successfully!");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to parse email";
      toast.error(msg);
    } finally {
      setIsParsingEmail(false);
    }
  };

  const handleSave = () => {
    if (!parsedEmailData) return;
    onSaveParsedEmail({
      title: parsedEmailData.title || "Unknown Role",
      company: parsedEmailData.company || "Unknown Company",
      location: parsedEmailData.location || "Remote",
      stage: parsedEmailData.stage || "saved",
      notes: parsedEmailData.summary || "",
    });
    onOpenChange(false);
    setEmailText("");
    setParsedEmailData(null);
  };

  const handleClose = () => {
    setEmailText("");
    setParsedEmailData(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            AI Recruiter Email Parser
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <p className="text-xs text-muted-foreground">
            Paste an email from a recruiter. Job Tayari AI will extract the role, company, stage (e.g. Phone Screen or Interview), and summarize next steps so you can create a card instantly.
          </p>
          <Textarea
            placeholder="Paste email headers and message content here..."
            rows={8}
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            className="font-sans bg-background/50 text-sm focus-visible:ring-primary/20"
          />

          {parsedEmailData && (
            <Card className="bg-primary/5 border-primary/10 mt-3">
              <CardHeader className="p-3 pb-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-primary">
                  <Info className="w-4 h-4" /> Parsed Results Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 text-xs space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-semibold text-muted-foreground">Role:</span>{" "}
                    {parsedEmailData.title || "Unknown"}
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Company:</span>{" "}
                    {parsedEmailData.company || "Unknown"}
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Location:</span>{" "}
                    {parsedEmailData.location || "Remote"}
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Detected Stage:</span>{" "}
                    <Badge variant="secondary" className="capitalize text-[10px]">
                      {parsedEmailData.stage}
                    </Badge>
                  </div>
                </div>
                {parsedEmailData.summary && (
                  <div className="border-t pt-2 mt-1">
                    <span className="font-semibold text-muted-foreground">AI Handoff Summary:</span>{" "}
                    <span className="italic">{parsedEmailData.summary}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {parsedEmailData ? (
            <Button onClick={handleSave}>Save & Import Card</Button>
          ) : (
            <Button onClick={handleParseEmailText} disabled={isParsingEmail}>
              {isParsingEmail ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Parse Email"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
