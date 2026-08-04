import React, { useState, useEffect } from 'react';
import { ShieldAlert, Zap, DollarSign, Mail, Mic, Play, CheckCircle, Flame, ArrowUpRight, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { getProfile, apiFetch } from '@/api';

export const RuthlessJobConsole: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [atsResult, setAtsResult] = useState<any>(null);
  const [batchResult, setBatchResult] = useState<any>(null);
  const [outreachResult, setOutreachResult] = useState<any>(null);
  const [negotiationResult, setNegotiationResult] = useState<any>(null);
  const [copilotResult, setCopilotResult] = useState<any>(null);

  // Dynamic user profile state
  const [resumeText, setResumeText] = useState<string>("");
  const [jobDescription, setJobDescription] = useState<string>("");
  const [jobUrlsInput, setJobUrlsInput] = useState<string>("");
  const [candidateName, setCandidateName] = useState<string>(user?.user_metadata?.full_name || "");
  const [candidateEmail, setCandidateEmail] = useState<string>(user?.email || "");
  const [outreachCompany, setOutreachCompany] = useState<string>("");
  const [outreachRecruiter, setOutreachRecruiter] = useState<string>("");
  const [outreachJobTitle, setOutreachJobTitle] = useState<string>("");
  const [offerInput, setOfferInput] = useState<number>(0);
  const [companyInput, setCompanyInput] = useState<string>("");
  const [copilotQuestion, setCopilotQuestion] = useState<string>("");

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
      }
    }).catch(() => {
      // Profile not created yet
    });
  }, [user]);

  const handleATSInject = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<any>('/v1/ai/agent/career/ats-prepare', {
        method: 'POST',
        body: JSON.stringify({
          resume_text: resumeText,
          job_description: jobDescription
        })
      });
      if (data && data.success) setAtsResult(data.data);
      else setError(data?.detail || 'ATS preparation failed.');
    } catch (e: any) {
      setError(e.message || 'ATS preparation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchApply = async () => {
    setLoading(true);
    setError(null);
    try {
      const parsedUrls = jobUrlsInput.split('\n').map(u => u.trim()).filter(Boolean);
      if (parsedUrls.length === 0) {
        setError("Please enter at least one job URL.");
        setLoading(false);
        return;
      }
      const data = await apiFetch<any>('/v1/ai/agent/career/universal-apply', {
        method: 'POST',
        body: JSON.stringify({
          job_urls: parsedUrls,
          candidate_profile: { name: candidateName, email: candidateEmail }
        })
      });
      if (data && data.success) setBatchResult(data.data);
      else setError(data?.detail || 'Batch apply failed.');
    } catch (e: any) {
      setError(e.message || 'Batch apply failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleColdOutreach = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<any>('/v1/ai/agent/career/outreach', {
        method: 'POST',
        body: JSON.stringify({
          company: outreachCompany,
          recruiter_name: outreachRecruiter,
          job_title: outreachJobTitle
        })
      });
      if (data && data.success) setOutreachResult(data.data);
      else setError(data?.detail || 'Recruiter outreach failed.');
    } catch (e: any) {
      setError(e.message || 'Recruiter outreach failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleNegotiate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<any>('/v1/ai/agent/career/ai-negotiate', {
        method: 'POST',
        body: JSON.stringify({
          current_offer: offerInput,
          target_role: outreachJobTitle || 'Staff Systems Architect',
          location: 'San Francisco, CA',
          company: companyInput
        })
      });
      if (data && data.success) setNegotiationResult(data.data);
      else setError(data?.detail || 'Salary negotiation failed.');
    } catch (e: any) {
      setError(e.message || 'Salary negotiation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopilot = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<any>('/v1/ai/agent/career/copilot', {
        method: 'POST',
        body: JSON.stringify({
          question: copilotQuestion,
          role: outreachJobTitle || 'Principal Systems Engineer'
        })
      });
      if (data && data.success) setCopilotResult(data.data);
      else setError(data?.detail || 'Copilot response failed.');
    } catch (e: any) {
      setError(e.message || 'Copilot response failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Ruthless Header */}
      <Card className="border-2 border-red-900/60 bg-gradient-to-r from-red-950 via-slate-950 to-red-950 text-white shadow-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/40">
                <Flame className="w-8 h-8 text-red-500 animate-bounce" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-2 text-red-400">
                  Ruthless Career Automation Command Center <Zap className="w-5 h-5 text-amber-400" />
                </CardTitle>
                <p className="text-xs text-slate-400">Claude Cowork + Manus AI Uncompromised Job Hunter</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-red-950 text-red-300 border-red-800">
                Batch Auto-Apply: Active
              </Badge>
              <Badge className="bg-amber-950 text-amber-300 border-amber-800">
                Stealth ATS Vectoring: Active
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <div className="p-4 rounded-lg bg-red-950/80 border border-red-800 text-red-300 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <Tabs defaultValue="batch" className="w-full">
        <TabsList className="grid grid-cols-5 bg-slate-900 border border-slate-800 p-1 rounded-lg">
          <TabsTrigger value="batch" className="data-[state=active]:bg-red-700 data-[state=active]:text-white">
            <Zap className="w-4 h-4 mr-2" /> Batch Auto-Apply
          </TabsTrigger>
          <TabsTrigger value="ats" className="data-[state=active]:bg-red-700 data-[state=active]:text-white">
            <ShieldAlert className="w-4 h-4 mr-2" /> Stealth ATS Payload
          </TabsTrigger>
          <TabsTrigger value="outreach" className="data-[state=active]:bg-red-700 data-[state=active]:text-white">
            <Mail className="w-4 h-4 mr-2" /> Recruiter Outreach
          </TabsTrigger>
          <TabsTrigger value="negotiate" className="data-[state=active]:bg-red-700 data-[state=active]:text-white">
            <DollarSign className="w-4 h-4 mr-2" /> Ruthless Negotiation
          </TabsTrigger>
          <TabsTrigger value="copilot" className="data-[state=active]:bg-red-700 data-[state=active]:text-white">
            <Mic className="w-4 h-4 mr-2" /> Live Copilot
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Batch Apply */}
        <TabsContent value="batch" className="mt-4">
          <Card className="border border-slate-800 bg-slate-900 text-slate-100 p-6 space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-300">Candidate Name</Label>
                  <Input
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="Alex Mercer"
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-300">Candidate Email</Label>
                  <Input
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    placeholder="alex@example.com"
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-300">Target Application URLs (One URL per line)</Label>
                <Textarea
                  rows={3}
                  value={jobUrlsInput}
                  onChange={(e) => setJobUrlsInput(e.target.value)}
                  placeholder="https://boards.greenhouse.io/acme/jobs/101"
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs font-mono"
                />
              </div>
            </div>
            <Button onClick={handleBatchApply} disabled={loading} className="bg-red-700 hover:bg-red-600 font-bold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 mr-2" />} Launch Batch Auto-Apply
            </Button>

            {batchResult && (
              <div className="space-y-3 pt-4 font-mono text-xs">
                <div className="flex justify-between items-center text-emerald-400 font-bold">
                  <span>Batch Status: {batchResult.success_rate} Success ({batchResult.total_submitted} Applications Submitted)</span>
                </div>
                <div className="space-y-2">
                  {batchResult.applications.map((ap: any) => (
                    <div key={ap.app_id} className="p-3 rounded bg-slate-950 border border-slate-800 flex justify-between items-center">
                      <div>
                        <span className="text-red-400 font-bold">{ap.app_id}</span> • {ap.portal} • <span className="text-slate-400">{ap.url}</span>
                      </div>
                      <Badge className="bg-emerald-950 text-emerald-300">Status: {ap.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 2: Stealth ATS Payload */}
        <TabsContent value="ats" className="mt-4">
          <Card className="border border-slate-800 bg-slate-900 text-slate-100 p-6 space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-300">Resume Content</Label>
                <Textarea
                  rows={3}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your resume text..."
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-300">Target Job Description</Label>
                <Textarea
                  rows={3}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste job description..."
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs font-mono"
                />
              </div>
            </div>
            <Button onClick={handleATSInject} disabled={loading} className="bg-amber-600 hover:bg-amber-500 font-bold">
              Inject Stealth Keyword Vectors
            </Button>

            {atsResult && (
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-amber-400">Predicted ATS Score: {atsResult.predicted_ats_score}%</span>
                </div>
                <div className="bg-black p-3 rounded text-amber-300 border border-amber-900/40">
                  <div className="text-[10px] text-slate-500 uppercase mb-1"># Injected Vector Payload / Recommendations</div>
                  <pre className="whitespace-pre-wrap">{atsResult.recommended_additions || atsResult.stealth_payload || atsResult.injected_keywords?.join(', ')}</pre>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 3: Recruiter Outreach */}
        <TabsContent value="outreach" className="mt-4">
          <Card className="border border-slate-800 bg-slate-900 text-slate-100 p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-300">Company Name</Label>
                <Input
                  value={outreachCompany}
                  onChange={(e) => setOutreachCompany(e.target.value)}
                  placeholder="Stripe"
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-300">Recruiter Name</Label>
                <Input
                  value={outreachRecruiter}
                  onChange={(e) => setOutreachRecruiter(e.target.value)}
                  placeholder="Sarah Jenkins"
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                />
              </div>
            </div>
            <Button onClick={handleColdOutreach} disabled={loading} className="bg-blue-600 hover:bg-blue-500 font-bold">
              Generate Recruiter Cold Outreach Sequence
            </Button>

            {outreachResult && (
              <div className="space-y-3 pt-2 font-mono text-xs">
                <div className="font-bold text-blue-400">Target Recruiter: {outreachResult.recruiter_name} ({outreachResult.company})</div>
                {outreachResult.email_sequence.map((em: any, idx: number) => (
                  <div key={idx} className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-indigo-400 font-bold">{em.step}</div>
                    <pre className="text-slate-300 whitespace-pre-wrap">{em.content}</pre>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 4: Salary Negotiation */}
        <TabsContent value="negotiate" className="mt-4">
          <Card className="border border-slate-800 bg-slate-900 text-slate-100 p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-300">Current Offer ($)</Label>
                <Input
                  type="number"
                  value={offerInput}
                  onChange={(e) => setOfferInput(Number(e.target.value))}
                  placeholder="185000"
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-300">Target Company</Label>
                <Input
                  value={companyInput}
                  onChange={(e) => setCompanyInput(e.target.value)}
                  placeholder="Anthropic"
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                />
              </div>
            </div>
            <Button onClick={handleNegotiate} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 font-bold">
              Generate Counter-Offer Script
            </Button>

            {negotiationResult && (
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center text-emerald-400 font-bold text-sm">
                  <span>Current: ${negotiationResult.current_offer?.toLocaleString()} → Target Counter: ${negotiationResult.counter_offer?.toLocaleString()} (+${negotiationResult.increase_amount?.toLocaleString()})</span>
                </div>
                <div className="bg-black p-3 rounded text-slate-200 border border-slate-800">
                  <pre className="whitespace-pre-wrap">{negotiationResult.negotiation_email_script}</pre>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 5: Live Copilot */}
        <TabsContent value="copilot" className="mt-4">
          <Card className="border border-slate-800 bg-slate-900 text-slate-100 p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-slate-300">Interview Question Prompt</Label>
              <Input
                value={copilotQuestion}
                onChange={(e) => setCopilotQuestion(e.target.value)}
                placeholder="How do you handle zero-downtime microservice migrations under peak traffic?"
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
              />
            </div>
            <Button onClick={handleCopilot} disabled={loading} className="bg-purple-600 hover:bg-purple-500 font-bold">
              Generate Instant Copilot STAR Answer ({"<"}1.5s)
            </Button>

            {copilotResult && (
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center text-purple-400 font-bold">
                  <span>Question: "{copilotResult.question}"</span>
                  <Badge className="bg-purple-950 text-purple-300">Latency: {copilotResult.response_time}</Badge>
                </div>
                <div className="bg-black p-3 rounded text-slate-200 border border-slate-800 whitespace-pre-wrap">
                  {copilotResult.star_method_answer}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RuthlessJobConsole;
