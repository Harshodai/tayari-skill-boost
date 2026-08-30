import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, Edit3, Eye, FileText, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { updateApproval } from '@/api/autopilot';

interface PendingApproval {
  id: string;
  action_type: string;
  action_payload: {
    company?: string;
    role?: string;
    form_fields?: Record<string, string>;
    keywords?: string[];
  };
  status: string;
  expires_at: string;
}

export const ApprovalDrawer: React.FC = () => {
  const [open, setOpen] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([
    {
      id: "APPR-9012",
      action_type: "SUBMIT_ATS_APPLICATION",
      action_payload: {
        company: "Stripe",
        role: "Staff Backend Architect",
        form_fields: {
          full_name: "Alex Mercer",
          email: "alex@example.com",
          linkedin: "https://linkedin.com/in/alex-mercer"
        },
        keywords: ["Go", "Distributed Systems", "Kubernetes", "PostgreSQL"]
      },
      status: "PENDING",
      expires_at: "In 45 minutes"
    }
  ]);

  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(pendingApprovals[0]);
  const [editableFields, setEditableFields] = useState<Record<string, string>>({});
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync editableFields from selectedApproval whenever selection changes
  useEffect(() => {
    if (selectedApproval?.action_payload.form_fields) {
      setEditableFields({ ...selectedApproval.action_payload.form_fields });
    } else {
      setEditableFields({});
    }
  }, [selectedApproval]);

  const handleApprove = async (id: string) => {
    setErrorMessage(null);
    try {
      await updateApproval(id, {
        status: "approved",
        form_fields: editableFields,
      });
      setActionStatus("APPROVED");
      setPendingApprovals(prev => prev.filter(p => p.id !== id));
      setSelectedApproval(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve";
      setErrorMessage(message);
    }
  };

  const handleReject = async (id: string) => {
    setErrorMessage(null);
    try {
      await updateApproval(id, {
        status: "rejected",
        form_fields: editableFields,
      });
      setActionStatus("REJECTED");
      setPendingApprovals(prev => prev.filter(p => p.id !== id));
      setSelectedApproval(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reject";
      setErrorMessage(message);
    }
  };

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 bg-primary hover:bg-primary/90 font-bold shadow-xl z-50"
      >
        <ShieldCheck className="w-4 h-4 mr-2" /> View HITL Action Approvals ({pendingApprovals.length})
      </Button>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-card border-l border-border text-foreground shadow-2xl z-50 p-6 flex flex-col justify-between overflow-y-auto font-sans">
      <div className="space-y-6">
        <div className="flex justify-between items-center border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
            <h2 className="text-lg font-bold">HITL Action Approval Drawer</h2>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
            ✕
          </Button>
        </div>

        {actionStatus && (
          <div className="p-3 bg-primary/10 border border-primary/30 text-primary rounded text-xs">
            Action marked as <span className="font-bold">{actionStatus}</span>. Request sent to approval API.
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-950 border border-red-800 text-red-300 rounded text-xs">
            <AlertCircle className="w-3 h-3 inline mr-1" /> {errorMessage}
          </div>
        )}

        {pendingApprovals.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <CheckCircle2 className="w-10 h-10 text-success mx-auto" />
            <p className="text-sm font-semibold text-muted-foreground">No Pending Approvals</p>
            <p className="text-xs text-muted-foreground">All automated external actions have been reviewed.</p>
          </div>
        ) : (
          selectedApproval && (
            <Card className="bg-card border-border text-foreground p-4 space-y-4">
              <div className="flex justify-between items-center">
                <Badge className="bg-amber-950 text-amber-300 border-amber-800">
                  {selectedApproval.action_type}
                </Badge>
                <span className="text-xs text-muted-foreground">Expires: {selectedApproval.expires_at}</span>
              </div>

              <div>
                <h3 className="font-bold text-foreground">{selectedApproval.action_payload.company}: {selectedApproval.action_payload.role}</h3>
                <p className="text-xs text-muted-foreground">Review pre-filled form input fields before external submission.</p>
              </div>

              {/* Editable Pre-Filled Fields */}
              <div className="space-y-3 border-t border-border pt-3">
                <h4 className="text-xs font-semibold text-primary flex items-center gap-1">
                  <Edit3 className="w-3.5 h-3.5" /> Edit Pre-Filled Form Values
                </h4>
                {Object.entries(editableFields).map(([key, val]) => {
                  const fieldId = `approval-field-${key}`;
                  return (
                    <div key={key} className="space-y-1">
                      <label htmlFor={fieldId} className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {key.replace(/_/g, ' ')}
                      </label>
                      <Input
                        id={fieldId}
                        value={val}
                        onChange={(e) => setEditableFields({ ...editableFields, [key]: e.target.value })}
                        className="bg-card border-border text-xs font-mono text-foreground"
                      />
                    </div>
                  );
                })}
              </div>

              {selectedApproval.action_payload.keywords && (
                <div className="space-y-1 pt-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">ATS Keyword Injections</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedApproval.action_payload.keywords.map((kw, i) => (
                      <Badge key={i} className="bg-card text-muted-foreground text-[10px]">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-border">
                <Button
                  onClick={() => handleReject(selectedApproval.id)}
                  variant="outline"
                  className="w-1/2 border-red-800 text-red-400 hover:bg-red-950 font-semibold"
                >
                  <XCircle className="w-4 h-4 mr-2" /> Reject
                </Button>
                <Button
                  onClick={() => handleApprove(selectedApproval.id)}
                  className="w-1/2 bg-success hover:bg-success text-primary-foreground font-bold"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Approve & Submit
                </Button>
              </div>
            </Card>
          )
        )}
      </div>

      <div className="text-center pt-4 border-t border-border text-[10px] text-muted-foreground">
        Durable Claude Cowork Gatekeeper Protocol
      </div>
    </div>
  );
};

export default ApprovalDrawer;
