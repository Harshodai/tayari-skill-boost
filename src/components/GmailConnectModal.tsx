import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, AlertCircle, Lock, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { getGmailLogin, getGmailStatus } from '@/api/dashboard';

interface GmailConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: (email: string) => void;
}

export const GmailConnectModal: React.FC<GmailConnectModalProps> = ({ isOpen, onClose, onConnected }) => {
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 'error' | 'verifying'>(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check for OAuth callback params on mount
  useEffect(() => {
    if (isOpen) {
      const params = new URLSearchParams(window.location.search);
      const gmailStatus = params.get('gmail');
      if (gmailStatus === 'connected') {
        // OAuth callback indicates connection; verify with backend status endpoint
        setStep('verifying');
        verifyGmailConnection();
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (gmailStatus === 'denied' || gmailStatus === 'error') {
        setStep('error');
        setErrorMessage(gmailStatus === 'denied'
          ? 'Gmail access was denied. Please try again and grant permission.'
          : 'An error occurred during Gmail connection. Please try again.');
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [isOpen, onConnected]);

  const verifyGmailConnection = async () => {
    try {
      const status = await getGmailStatus();
      if (status.connected && status.email) {
        // Backend confirms connection and returns the server-owned email identity
        setVerifiedEmail(status.email);
        setStep(2);
        if (onConnected) onConnected(status.email);
      } else {
        // Backend doesn't confirm connection or email not returned
        setStep('error');
        setErrorMessage(status.message || 'Gmail connection not verified. Please try again.');
      }
    } catch (error) {
      setStep('error');
      const message = error instanceof Error ? error.message : 'Failed to verify Gmail connection';
      setErrorMessage(message);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { auth_url } = await getGmailLogin();
      // Redirect to Google OAuth consent screen
      window.location.href = auth_url;
    } catch (error) {
      setLoading(false);
      const message = error instanceof Error ? error.message : 'Failed to initiate Gmail OAuth';
      setErrorMessage(message);
      setStep('error');
    }
  };

  const handleRetry = () => {
    setStep(1);
    setErrorMessage(null);
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="bg-card border-border max-w-md p-6 space-y-6 text-foreground shadow-2xl"
        aria-labelledby="gmail-connect-title"
      >
        <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 text-muted-foreground hover:text-foreground transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900" aria-label="Close Gmail connection dialog">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>

        {step === 1 ? (
          <>
            <DialogHeader className="text-center space-y-2">
              <div className="p-3 bg-blue-950 w-max mx-auto rounded-full text-blue-400 border border-blue-800">
                <Mail className="w-8 h-8" />
              </div>
              <DialogTitle id="gmail-connect-title" className="text-xl font-bold">
                Connect Gmail Read-Only Access
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Automatically scan recruiter invitations, interview schedules, and application updates.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="p-3 bg-card rounded-lg border border-border space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Lock className="w-4 h-4 text-success" /> Review Gmail permissions
                </div>
                <p>
                  Google&apos;s <code>gmail.readonly</code> scope permits the connected application to read mailbox messages. Tayari requests the scope shown on the Google consent screen; it is not a mailbox-limited permission. Connect only if you understand and accept that scope.
                </p>
                <p>
                  This connector is beta. Message query scope, retention, disconnect, and deletion behavior depend on the deployment and must be reviewed before production use. Do not connect a mailbox you are not comfortable granting read-only access to.
                </p>
              </div>

              <Button
                onClick={handleConnect}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 font-bold text-primary-foreground"
              >
                {loading ? "Opening Google consent..." : "Review Gmail consent"}
              </Button>
            </div>
          </>
        ) : step === 'verifying' ? (
          <div className="text-center space-y-4 py-4">
            <div className="p-3 bg-blue-950 w-max mx-auto rounded-full text-blue-400 border border-blue-800 animate-pulse">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-blue-400">Verifying Connection</h2>
              <p className="text-xs text-muted-foreground">Confirming Gmail account with server...</p>
            </div>
          </div>
        ) : step === 2 ? (
          <div className="text-center space-y-4 py-4">
            <div className="p-3 bg-success w-max mx-auto rounded-full text-success border border-success">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-success">Gmail Connected Successfully</h2>
              <p className="text-xs text-muted-foreground">
                Connected <code>{verifiedEmail || 'verified Gmail account'}</code>. Interview classification remains read-only and beta; review your connected-data controls before relying on it for a hiring process.
              </p>
            </div>
            <Button onClick={handleClose} className="w-full bg-slate-800 hover:bg-slate-700 font-semibold">
              Done
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-4 py-4">
            <div className="p-3 bg-red-950 w-max mx-auto rounded-full text-red-400 border border-red-800">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-red-400">Connection Failed</h2>
              <p className="text-xs text-muted-foreground">{errorMessage}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleRetry} className="flex-1 bg-blue-600 hover:bg-blue-500 font-bold text-primary-foreground">
                Try Again
              </Button>
              <Button onClick={handleClose} className="flex-1 bg-slate-800 hover:bg-slate-700 font-semibold">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GmailConnectModal;
