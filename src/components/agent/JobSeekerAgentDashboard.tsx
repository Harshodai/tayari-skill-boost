import React, { useState, useEffect } from 'react';
import { Search, FileText, Send, BookOpen, CheckCircle2, Sparkles, Loader2, Briefcase, Building2, UserCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { getProfile, apiFetch } from '@/api';

export const JobSeekerAgentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [jobQuery, setJobQuery] = useState('Full Stack Engineer');
  const [location, setLocation] = useState('Remote');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any>(null);
  const [tailorResult, setTailorResult] = useState<any>(null);
  const [autofillResult, setAutofillResult] = useState<any>(null);
  const [interviewBrief, setInterviewBrief] = useState<any>(null);

  const [targetCompany, setTargetCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [targetFormUrl, setTargetFormUrl] = useState('');
  const [candidateName, setCandidateName] = useState(user?.user_metadata?.full_name || '');
  const [candidateEmail, setCandidateEmail] = useState(user?.email || '');

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
          setJobDescription(text);
        }
      }
    }).catch(() => {
      // Profile not created yet
    });
  }, [user]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>('/v1/ai/agent/job-seeker/search', {
        method: 'POST',
        body: JSON.stringify({ query: jobQuery, location })
      });
      if (data && data.success) setSearchResults(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleTailor = async (company: string = targetCompany) => {
    setLoading(true);
    try {
      const data = await apiFetch<any>('/v1/ai/agent/job-seeker/tailor', {
        method: 'POST',
        body: JSON.stringify({
          job_title: jobQuery,
          company: company || targetCompany,
          job_description: jobDescription
        })
      });
      if (data && data.success) setTailorResult(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFill = async (url: string = targetFormUrl) => {
    setLoading(true);
    try {
      const data = await apiFetch<any>('/v1/ai/agent/job-seeker/autofill', {
        method: 'POST',
        body: JSON.stringify({
          form_url: url || targetFormUrl,
          user_profile: { name: candidateName, email: candidateEmail }
        })
      });
      if (data && data.success) setAutofillResult(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleInterviewPrep = async (company: string = targetCompany) => {
    setLoading(true);
    try {
      const data = await apiFetch<any>('/v1/ai/agent/job-seeker/interview-prep', {
        method: 'POST',
        body: JSON.stringify({ company: company || targetCompany })
      });
      if (data && data.success) setInterviewBrief(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header Banner */}
      <Card className="border border-indigo-800 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 text-white shadow-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
                <Briefcase className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  Job Seeker Autonomous Agent System <Sparkles className="w-5 h-5 text-amber-400" />
                </CardTitle>
                <p className="text-sm text-slate-400">Powered by Claude Cowork + Manus AI Execution Architecture</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800">
                Playwright Auto-Scraper: Ready
              </Badge>
              <Badge className="bg-purple-950 text-purple-300 border-purple-800">
                Computer Use Form Filler: Ready
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs Menu */}
      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid grid-cols-4 bg-slate-900 border border-slate-800 p-1 rounded-lg">
          <TabsTrigger value="search" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Search className="w-4 h-4 mr-2" /> Job Scraping
          </TabsTrigger>
          <TabsTrigger value="tailor" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <FileText className="w-4 h-4 mr-2" /> CodeAct Resume Customizer
          </TabsTrigger>
          <TabsTrigger value="autofill" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Send className="w-4 h-4 mr-2" /> Auto-Application Filler
          </TabsTrigger>
          <TabsTrigger value="prep" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <BookOpen className="w-4 h-4 mr-2" /> Swarm Interview Prep
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Job Scraping */}
        <TabsContent value="search" className="mt-4">
          <Card className="border border-slate-800 bg-slate-900 text-slate-100 p-6 space-y-4">
            <div className="flex gap-3">
              <Input
                value={jobQuery}
                onChange={(e) => setJobQuery(e.target.value)}
                placeholder="Target Job Title (e.g. Senior Software Engineer)"
                className="bg-slate-950 border-slate-800"
              />
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location (e.g. Remote)"
                className="w-48 bg-slate-950 border-slate-800"
              />
              <Button onClick={handleSearch} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />} Scrape Jobs
              </Button>
            </div>

            {searchResults && (
              <div className="space-y-3 pt-4">
                <h4 className="text-sm font-semibold text-emerald-400">Found {searchResults.total_found} Targeted Positions:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchResults.jobs.map((jb: any) => (
                    <div key={jb.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-100">{jb.title}</span>
                        <Badge className="bg-emerald-950 text-emerald-300">ATS Match: {jb.ats_score}%</Badge>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5" /> {jb.company} • {jb.portal}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={() => handleTailor(jb.company)} className="bg-slate-800 hover:bg-slate-700 text-xs">
                          Tailor Resume
                        </Button>
                        <Button size="sm" onClick={() => handleAutoFill(jb.url)} className="bg-emerald-700 hover:bg-emerald-600 text-xs">
                          Auto-Apply
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 2: CodeAct Tailoring */}
        <TabsContent value="tailor" className="mt-4">
          <Card className="border border-slate-800 bg-slate-900 text-slate-100 p-6 space-y-4">
            <Button onClick={() => handleTailor(targetCompany)} disabled={loading} className="bg-purple-600 hover:bg-purple-500">
              Run CodeAct Resume Tailoring
            </Button>

            {tailorResult && (
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-purple-400">Customized Application Package</span>
                  <Badge className="bg-purple-950 text-purple-300">Score: {tailorResult.ats_match_score}%</Badge>
                </div>
                <div className="bg-black p-3 rounded font-mono text-xs text-emerald-300">
                  <pre className="whitespace-pre-wrap">{tailorResult.codeact_repl_output.stdout || tailorResult.codeact_repl_output.error}</pre>
                </div>
                <div className="text-xs text-slate-400">Saved cover letter file: {tailorResult.cover_letter_file}</div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 3: Auto-Fill Application */}
        <TabsContent value="autofill" className="mt-4">
          <Card className="border border-slate-800 bg-slate-900 text-slate-100 p-6 space-y-4">
            <Button onClick={() => handleAutoFill()} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500">
              Trigger Computer Use Auto-Fill
            </Button>

            {autofillResult && (
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-emerald-400 font-bold">
                  <span>Application Status: {autofillResult.status.toUpperCase()}</span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="space-y-1 text-slate-300">
                  {autofillResult.actions_taken.map((act: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-indigo-400">✓</span> {act}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 4: Interview Prep */}
        <TabsContent value="prep" className="mt-4">
          <Card className="border border-slate-800 bg-slate-900 text-slate-100 p-6 space-y-4">
            <Button onClick={() => handleInterviewPrep(targetCompany)} disabled={loading} className="bg-amber-600 hover:bg-amber-500">
              Delegate Swarm Company Research
            </Button>

            {interviewBrief && (
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="font-bold text-amber-400">Company Intelligence Brief: {interviewBrief.company}</h4>
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="font-semibold text-slate-200">Key Talking Points:</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {interviewBrief.key_talking_points.map((tp: string, idx: number) => (
                      <li key={idx}>{tp}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default JobSeekerAgentDashboard;
