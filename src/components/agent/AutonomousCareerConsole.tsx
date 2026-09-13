import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Zap, DollarSign, Mail, Mic, Play, CheckCircle2, XCircle, Sparkles, Loader2, Building2, Eye, UserCheck, Calendar, SquareKanban, Inbox } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetchResponse, getProfile, apiFetch } from "@/api";
import { useToast } from '@/hooks/use-toast';

export const AutonomousCareerConsole: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [hitlProposal, setHitlProposal] = useState<any>(null);
  const [hitlConfirmed, setHitlConfirmed] = useState<any>(null);
  const [universalResult, setUniversalResult] = useState<any>(null);
  const [outreachResult, setOutreachResult] = useState<any>(null);
  const [aiNegotiationResult, setAiNegotiationResult] = useState<any>(null);
  const [copilotResult, setCopilotResult] = useState<any>(null);
  const [emailSyncResult, setEmailSyncResult] = useState<any>(null);
  const [kanbanBoard, setKanbanBoard] = useState<any>(null);

  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const interviewBoardReqIdRef = useRef(0);

  const fetchInterviewBoard = async () => {
    const reqId = ++interviewBoardReqIdRef.current;
    try {
      const data = await apiFetch<any>('/v1/ai/agent/career/interview-board');
      if (reqId === interviewBoardReqIdRef.current) {
        if (data && data.success) {
          setKanbanBoard(data.data);
          setErrorBanner(null);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load interview board';
      if (reqId === interviewBoardReqIdRef.current) {
        setErrorBanner(msg);
      }
      toast({ title: 'Interview Board Error', description: msg, variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchInterviewBoard();
  }, []);

  const handleEmailSync = async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const data = await apiFetch<any>('/v1/ai/agent/career/email-sync', { method: 'POST' });
      if (data && data.success) {
        setEmailSyncResult(data.data);
        if (data.data.current_kanban_board) {
          setKanbanBoard(data.data.current_kanban_board);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Email sync failed';
      setErrorBanner(msg);
      toast({ title: 'Sync Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleMoveKanbanCard = async (cardId: string, newStage: string) => {
    try {
      const data = await apiFetch<any>('/v1/ai/agent/career/interview-board/update', {
        method: 'POST',
        body: JSON.stringify({ card_id: cardId, new_stage: newStage })
      });
      if (data && data.success) {
        fetchInterviewBoard();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to move card';
      setErrorBanner(msg);
      toast({ title: 'Update Error', description: msg, variant: 'destructive' });
    }
  };

  const { user } = useAuth();
  const { toast } = useToast();

  // Dynamic state variables
  const [resumeText, setResumeText] = useState<string>("");
  const [jobDescription, setJobDescription] = useState<string>("");
  const [jobUrlsInput, setJobUrlsInput] = useState<string>("");
  const [candidateName, setCandidateName] = useState<string>(user?.user_metadata?.full_name || "");
  const [candidateEmail, setCandidateEmail] = useState<string>(user?.email || "");
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [negotiationError, setNegotiationError] = useState<string | null>(null);

  const [negotiationOffer, setNegotiationOffer] = useState<string>("");
  const [negotiationRole, setNegotiationRole] = useState<string>("");
  const [negotiationLocation, setNegotiationLocation] = useState<string>("");
  const [negotiationCompany, setNegotiationCompany] = useState<string>("");

  const [outreachCompany, setOutreachCompany] = useState<string>("");
  const [outreachRecruiter, setOutreachRecruiter] = useState<string>("");
  const [outreachJobTitle, setOutreachJobTitle] = useState<string>("");

  const [copilotQuestion, setCopilotQuestion] = useState<string>("");
  const [copilotRole, setCopilotRole] = useState<string>("");

  useEffect(() => {
    if (user) {
      if (user.user_metadata?.full_name) setCandidateName(user.user_metadata.full_name);
      if (user.email) setCandidateEmail(user.email);
    }
    getProfile().then(p => {
      if (p) {
        if (p.full_name) setCandidateName(p.full_name);
        if (p.summary || p.headline) {
          const text = p.summary || `${p.headline || ''}${p.skills?.length ? `. Skills: ${p.skills.join(', ')}` : ''}`;
          setResumeText(text);
        }
        if (p.desired_roles?.length || p.skills?.length) {
          setJobDescription(`Role: ${p.desired_roles?.join(', ') || 'Software Engineer'}. Requirements: ${p.skills?.join(', ') || 'Python, Distributed Systems'}`);
        }
      }
    }).catch(() => {
      // Profile not created yet
    });
  }, [user]);

  const handleATSPrepare = async () => {
    setLoading(true);
    setHitlConfirmed(null);
    try {
      const data = await apiFetch<any>('/v1/ai/agent/career/ats-prepare', {
        method: 'POST',
        body: JSON.stringify({
          resume_text: resumeText,
          job_description: jobDescription
        })
      });
      if (data && data.success) setHitlProposal(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleATSConfirm = async (approved: boolean) => {
    if (!hitlProposal) return;
    setLoading(true);
    try {
      const data = await apiFetch<any>('/v1/ai/agent/career/ats-confirm', {
        method: 'POST',
        body: JSON.stringify({
          approval_id: hitlProposal.approval_id,
          approved,
          custom_keywords: hitlProposal.extracted_keywords || []
        })
      });
      if (data && data.success) {
        setHitlConfirmed(data.data);
        setHitlProposal(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUniversalApply = async () => {
    setLoading(true);
    try {
      const parsedUrls = jobUrlsInput.split('\n').map(u => u.trim()).filter(Boolean);
      const data = await apiFetch<any>('/v1/ai/agent/career/universal-apply', {
        method: 'POST',
        body: JSON.stringify({
          job_urls: parsedUrls,
          candidate_profile: { name: candidateName, email: candidateEmail }
        })
      });
      if (data && data.success) setUniversalResult(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAINegotiate = async () => {
    const offer = parseInt(negotiationOffer, 10);
    if (!negotiationRole || !offer || offer <= 0) {
      toast({
        title: 'Missing negotiation details',
        description: 'Enter a target role and a positive base offer.',
        variant: 'destructive'
      });
      return;
    }
    setLoading(true);
    setNegotiationError(null);
    setAiNegotiationResult(null);
    try {
      const data = await apiFetch<any>('/v1/ai/agent/career/ai-negotiate', {
        method: 'POST',
        body: JSON.stringify({
          current_offer: offer,
          target_role: negotiationRole,
          location: negotiationLocation,
          company: negotiationCompany
        })
      });
      if (data && data.success) setAiNegotiationResult(data.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Negotiation request failed';
      setNegotiationError(message);
      toast({ title: 'Negotiation failed', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleOutreach = async () => {
    if (!outreachCompany || !outreachRecruiter || !outreachJobTitle) {
      toast({
        title: 'Missing outreach details',
        description: 'Enter the company, recruiter name, and job title.',
        variant: 'destructive'
      });
      return;
    }
    setLoading(true);
    setOutreachError(null);
    try {
      const res = await apiFetchResponse('/v1/ai/agent/career/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: outreachCompany,
          recruiter_name: outreachRecruiter,
          job_title: outreachJobTitle
        })
      });
      const data = await res.json();
      if (data.success) {
        setOutreachResult(data.data);
      } else {
        const message = data.error || 'Outreach request failed';
        setOutreachError(message);
        toast({ title: 'Outreach failed', description: message, variant: 'destructive' });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Outreach request failed';
      setOutreachError(message);
      toast({ title: 'Outreach failed', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopilot = async () => {
    if (!copilotQuestion || !copilotRole) {
      toast({
        title: 'Missing copilot details',
        description: 'Enter the interview question and target role.',
        variant: 'destructive'
      });
      return;
    }
    setLoading(true);
    setCopilotError(null);
    setCopilotResult(null);
    try {
      const res = await apiFetchResponse('/v1/ai/agent/career/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: copilotQuestion,
          role: copilotRole
        })
      });
      const data = await res.json();
      if (data.success) {
        setCopilotResult(data.data);
      } else {
        const message = data.error || 'Copilot request failed';
        setCopilotError(message);
        toast({ title: 'Copilot failed', description: message, variant: 'destructive' });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Copilot request failed';
      setCopilotError(message);
      toast({ title: 'Copilot failed', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border border-slate-800 bg-slate-950 text-white shadow-xl">
        <CardHeader className="bg-gradient-to-r from-slate-900 via-primary/10 to-slate-900 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-primary/20 rounded-xl border border-primary/30">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  Executive Career Command Center <Sparkles className="w-5 h-5 text-amber-400" />
                </CardTitle>
                <p className="text-xs text-slate-400">Claude Cowork + Manus AI Autonomous Career Engine with Email Connector & Interview Board</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-blue-950 text-blue-300 border-blue-800">
                Email Sync: Gmail OAuth
              </Badge>
              <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800">
                Kanban Interview Board: Active
              </Badge>
              <Badge className="bg-accent/10 text-accent border-accent/30">
                25+ Portals: Supported
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {errorBanner && (
        <div className="p-4 bg-red-950/80 border border-red-800 text-red-200 rounded-lg text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setErrorBanner(null)} className="text-red-400 hover:text-white">
            Dismiss
          </Button>
        </div>
      )}

      <Tabs defaultValue="board" className="w-full">
        <TabsList className="grid grid-cols-6 bg-slate-900 border border-slate-800 p-1 rounded-lg">
          <TabsTrigger value="board" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <SquareKanban className="w-4 h-4 mr-2" /> Interview Board
          </TabsTrigger>
          <TabsTrigger value="email" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <Inbox className="w-4 h-4 mr-2" /> Email Connector
          </TabsTrigger>
          <TabsTrigger value="ats" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <ShieldCheck className="w-4 h-4 mr-2" /> HITL ATS Review
          </TabsTrigger>
          <TabsTrigger value="apply" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <Zap className="w-4 h-4 mr-2" /> Universal Portals
          </TabsTrigger>
          <TabsTrigger value="negotiate" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <DollarSign className="w-4 h-4 mr-2" /> AI Compensation
          </TabsTrigger>
          <TabsTrigger value="copilot" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <Mic className="w-4 h-4 mr-2" /> Live Copilot
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Interview Board (Kanban UI) */}
        <TabsContent value="board" className="mt-4">
          <Card className="border border-slate-800 bg-slate-900 text-slate-100 p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                <SquareKanban className="w-5 h-5" /> Application & Interview Kanban Pipeline
              </h3>
              <Button size="sm" onClick={fetchInterviewBoard} className="bg-slate-800 hover:bg-slate-700">
                Refresh Board
              </Button>
            </div>

            {kanbanBoard && (
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 overflow-x-auto pt-2">
                {Object.entries(kanbanBoard).map(([stage, cards]: [string, any]) => {
                  const stageCards = Array.isArray(cards) ? cards : [];
                  return (
                    <div key={stage} className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-3 min-w-[180px]">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-400 border-b border-slate-800 pb-2">
                        <span>{stage.replace(/_/g, ' ')}</span>
                        <Badge className="bg-slate-800 text-slate-200">{stageCards.length}</Badge>
                      </div>

                      {stageCards.map((cd: any) => (
                        <div key={cd.card_id} className="p-3 rounded bg-slate-900 border border-slate-800 space-y-2 text-xs">
                          <div className="font-bold text-slate-100">{cd.company}</div>
                          <div className="text-[11px] text-primary">{cd.role}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-emerald-400" /> {cd.interview_date}
                          </div>
                          {cd.prep_brief && (
                            <div className="text-[10px] text-slate-500 italic">
                              Tech: {cd.prep_brief.tech_stack?.join(', ') || 'Custom Prep'}
                            </div>
                          )}
                          <div className="flex gap-1 pt-1">
                            {stage !== 'OFFER_STAGE' && (
                              <Button size="sm" onClick={() => handleMoveKanbanCard(cd.card_id, 'OFFER_STAGE')} className="h-6 text-[9px] bg-accent hover:bg-accent/90">
                                Move to Offer
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 2: Email Connector */}
        <TabsContent value="email" className="mt-4">
          <Card className="border border-slate-800 bg-slate-900 text-slate-100 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                  <Inbox className="w-5 h-5" /> Connected Recruiter Email Sync Hub
                </h3>
                <p className="text-xs text-slate-400">OAuth connected to Gmail ({candidateEmail || 'your account'})</p>
              </div>
              <Button onClick={handleEmailSync} disabled={loading} className="bg-blue-600 hover:bg-blue-500 font-semibold">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Inbox className="w-4 h-4 mr-2" />} Scan Inbox & Sync Calendar
              </Button>
            </div>

            {emailSyncResult && (
              <div className="space-y-4 pt-2 text-xs font-mono">
                <div className="p-3 bg-blue-950/40 rounded border border-blue-800 text-blue-300 flex items-center justify-between">
                  <span>Detected {emailSyncResult.email_scan_summary?.invites_detected || 0} recruiter interview invitations!</span>
                  <Badge className="bg-emerald-950 text-emerald-300">Auto-Synced to Kanban Board</Badge>
                </div>

                <div className="space-y-3">
                  {emailSyncResult.email_scan_summary?.parsed_invites?.map((inv: any) => (
                    <div key={inv.email_id} className="p-4 bg-slate-950 rounded border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-slate-200 font-bold">
                        <span>{inv.company}: {inv.subject}</span>
                        <span className="text-emerald-400">{inv.proposed_date}</span>
                      </div>
                      <div className="text-slate-400 text-[11px]">Meeting Link: <span className="text-primary">{inv.meeting_link}</span></div>
                      <div className="p-2.5 bg-black rounded border border-slate-800 text-slate-300">
                        <div className="text-[10px] text-slate-500 uppercase mb-1"># Generated Communication Auto-Reply Draft</div>
                        <pre className="whitespace-pre-wrap">{inv.auto_reply_draft.body}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 3: HITL ATS Review */}
        <TabsContent value="ats" className="mt-4">
          <Card className="border border-slate-800 bg-slate-900 text-slate-100 p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Candidate Resume / Profile</Label>
                <Textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste candidate resume or profile text..."
                  className="bg-slate-950 border-slate-800 h-28 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Target Job Description</Label>
                <Textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste target job description..."
                  className="bg-slate-950 border-slate-800 h-28 text-xs font-mono"
                />
              </div>
            </div>

            <Button onClick={handleATSPrepare} disabled={loading} className="bg-primary hover:bg-primary/90 font-semibold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />} Prepare ATS Optimization Proposal (HITL)
            </Button>

            {hitlProposal && (
              <div className="p-4 rounded-lg bg-amber-950/40 border border-amber-800 space-y-3">
                <div className="flex justify-between items-center text-amber-300 font-bold">
                  <span className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4" /> Human-in-the-Loop Approval Required: [{hitlProposal.approval_id}]
                  </span>
                  <Badge className="bg-amber-900 text-amber-200">Predicted Score: {hitlProposal.predicted_ats_score_before}% → {hitlProposal.predicted_ats_score_after}%</Badge>
                </div>
                <div className="text-xs text-slate-300">
                  Extracted Keywords: <span className="font-mono text-emerald-400">{(hitlProposal.extracted_keywords || []).join(', ')}</span>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button size="sm" onClick={() => handleATSConfirm(true)} className="bg-emerald-600 hover:bg-emerald-500">
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Approve & Keep Optimized Resume
                  </Button>
                  <Button size="sm" onClick={() => handleATSConfirm(false)} variant="outline" className="border-red-800 text-red-400 hover:bg-red-950">
                    <XCircle className="w-4 h-4 mr-1" /> Decline Optimization
                  </Button>
                </div>
              </div>
            )}

            {hitlConfirmed && (
              <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-mono space-y-2">
                <div className="font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Status: {hitlConfirmed.status}
                </div>
                <div>Final ATS Target Score: {hitlConfirmed.final_ats_score}%</div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 4: Universal Portals */}
        <TabsContent value="apply" className="mt-4">
          <Card className="border border-slate-800 bg-slate-900 text-slate-100 p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Target Job URLs (One per line)</Label>
              <Textarea
                value={jobUrlsInput}
                onChange={(e) => setJobUrlsInput(e.target.value)}
                placeholder={`https://boards.greenhouse.io/...\nhttps://jobs.lever.co/...`}
                className="bg-slate-950 border-slate-800 h-28 text-xs font-mono"
              />
            </div>

              <Button onClick={handleUniversalApply} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 font-semibold">
              Prepare Application Forms for Review (up to 10)
              </Button>

            {universalResult && (
              <div className="space-y-3 pt-4 font-mono text-xs">
                <div className="text-amber-400 font-bold">
                  Prepared {universalResult.total_prepared ?? 0} of {universalResult.total_processed ?? 0} forms
                  across Portals: {universalResult.portals_covered.join(', ')} — nothing submitted
                </div>
                <div className="space-y-2">
                  {universalResult.applications.map((ap: any) => (
                    <div key={ap.run_id} className="p-3 rounded bg-slate-950 border border-slate-800 flex justify-between items-center">
                      <div>
                        <span className="text-primary font-bold">{ap.run_id}</span> • Portal: <span className="text-slate-200 font-bold">{ap.portal}</span> • <span className="text-slate-400">{ap.url}</span>
                      </div>
                      <Badge className={ap.status === 'FORM_PREPARED' ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'}>
                        {ap.status}{ap.questions_queued ? ` · ${ap.questions_queued} question(s)` : ''}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 5: AI Compensation */}
        <TabsContent value="negotiate" className="mt-4">
          <Card className="border border-slate-800 bg-slate-900 text-slate-100 p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Current Base Offer ($)</Label>
                <Input
                  type="number"
                  value={negotiationOffer}
                  onChange={(e) => setNegotiationOffer(e.target.value)}
                  placeholder="e.g. 190000"
                  className="bg-slate-950 border-slate-800 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Target Role</Label>
                <Input
                  value={negotiationRole}
                  onChange={(e) => setNegotiationRole(e.target.value)}
                  placeholder="e.g. Staff Systems Architect"
                  className="bg-slate-950 border-slate-800 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Location</Label>
                <Input
                  value={negotiationLocation}
                  onChange={(e) => setNegotiationLocation(e.target.value)}
                  placeholder="e.g. San Francisco, CA"
                  className="bg-slate-950 border-slate-800 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Company</Label>
                <Input
                  value={negotiationCompany}
                  onChange={(e) => setNegotiationCompany(e.target.value)}
                  placeholder="e.g. Anthropic"
                  className="bg-slate-950 border-slate-800 text-xs font-mono"
                />
              </div>
            </div>

            <Button onClick={handleAINegotiate} disabled={loading} className="bg-accent hover:bg-accent/90 font-semibold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />} Generate AI Salary Negotiation Strategy
            </Button>

            {negotiationError && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-xs font-mono mb-3">
                <span className="font-bold">Error:</span> {negotiationError}
              </div>
            )}

            {aiNegotiationResult && aiNegotiationResult.llm_available !== false && (
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <div className="text-accent font-bold text-sm">
                    Base Offer: ${aiNegotiationResult.current_offer?.toLocaleString?.()} → Target Counter: ${aiNegotiationResult.target_counter_offer?.toLocaleString?.()}
                  </div>
                  <Badge className="bg-amber-950 text-amber-300 border-amber-800">Sample output — not from a live model</Badge>
                </div>
                <div className="bg-slate-900 p-3 rounded text-slate-300 border border-slate-800">
                  <div className="text-[10px] text-accent uppercase mb-1 font-bold"># AI Dynamic Strategy</div>
                  <p className="whitespace-pre-wrap">{aiNegotiationResult.ai_negotiation_strategy}</p>
                </div>
                <div className="bg-black p-3 rounded text-slate-200 border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase mb-1"># Generated Counter-Offer Script</div>
                  <pre className="whitespace-pre-wrap">{aiNegotiationResult.counter_offer_script}</pre>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 6: Live Copilot */}
        <TabsContent value="copilot" className="mt-4">
          <Card className="border border-slate-800 bg-slate-900 text-slate-100 p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Target Role</Label>
              <Input
                value={copilotRole}
                onChange={(e) => setCopilotRole(e.target.value)}
                placeholder="e.g. Principal Architect"
                className="bg-slate-950 border-slate-800 text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Interview Question</Label>
              <Textarea
                value={copilotQuestion}
                onChange={(e) => setCopilotQuestion(e.target.value)}
                placeholder="e.g. How do you handle zero-downtime database migrations under high write traffic?"
                className="bg-slate-950 border-slate-800 h-28 text-xs font-mono"
              />
            </div>

            <Button onClick={handleCopilot} disabled={loading} className="bg-primary hover:bg-primary/90 font-semibold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4 mr-2" />} Generate AI STAR-Method Answer
            </Button>

            {copilotError && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-xs font-mono mb-3">
                <span className="font-bold">Error:</span> {copilotError}
              </div>
            )}

            {copilotResult && (
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-primary">Question: "{copilotResult.question}"</div>
                  <Badge className="bg-amber-950 text-amber-300 border-amber-800">Sample output — not from a live model</Badge>
                </div>
                <div className="p-3 bg-black rounded text-slate-200 whitespace-pre-wrap">{copilotResult.star_answer}</div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AutonomousCareerConsole;
