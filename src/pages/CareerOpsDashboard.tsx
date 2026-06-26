import React, { useState, useEffect } from 'react';
import { Terminal, RefreshCw, Send, Plus, Trash2, Award, PieChart, CheckCircle2, AlertTriangle, Play, Calendar, HelpCircle, FileText, ChevronRight, Check, ToggleLeft, ToggleRight, Filter, X } from 'lucide-react';
import { EvaluationReportPanel } from '../components/EvaluationReportPanel';
import { listCareerOpsPortals, createCareerOpsPortal, deleteCareerOpsPortal, updateCareerOpsPortal, scanCareerOpsPortals, getCareerOpsPatterns, listCareerOpsFollowups, actionCareerOpsFollowup, getCareerOpsStoryBank, saveCareerOpsStoryBank, deleteCareerOpsStoryBank, getCareerOpsStats } from '../api';

interface Portal {
  id?: number;
  name: string;
  careers_url: string;
  provider: string;
  enabled: boolean;
  keywords_override?: string[];
}

interface Followup {
  id: number;
  application_id: string;
  company: string;
  role: string;
  stage: string;
  age_days: number;
  followups_sent: number;
  urgency: string;
  reason: string;
  draft_subject: string;
  draft_body: string;
}

interface Story {
  requirement: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
}

interface Stats {
  total_portals: number;
  total_jobs_found: number;
  total_applications: number;
  active_scans: number;
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

interface FilterState {
  minScore: string;
  keyword: string;
  lastNDays: string;
}

const FunnelStage = ({ label, pct, color }: { label: string; pct: number; color: string }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs">
      <span className="text-slate-300 font-medium">{label}</span>
      <span className="text-slate-400">{pct}%</span>
    </div>
    <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  </div>
);

export const CareerOpsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scanner' | 'calibration' | 'followup' | 'storybank'>('scanner');

  const [portals, setPortals] = useState<Portal[]>([]);
  const [newPortalName, setNewPortalName] = useState('');
  const [newPortalUrl, setNewPortalUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any[]>([]);

  const [patterns, setPatterns] = useState<any>(null);

  const [followups, setFollowups] = useState<Followup[]>([]);
  const [sendingFollowupId, setSendingFollowupId] = useState<string | null>(null);
  const [followupNotes, setFollowupNotes] = useState('');
  const [followupContact, setFollowupContact] = useState('');

  const [stories, setStories] = useState<Story[]>([]);
  const [newStoryReq, setNewStoryReq] = useState('');
  const [newStoryS, setNewStoryS] = useState('');
  const [newStoryT, setNewStoryT] = useState('');
  const [newStoryA, setNewStoryA] = useState('');
  const [newStoryR, setNewStoryR] = useState('');
  const [newStoryRef, setNewStoryRef] = useState('');

  const [stats, setStats] = useState<Stats | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);
  const [evaluateAppId, setEvaluateAppId] = useState<string | null>(null);

  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ minScore: '', keyword: '', lastNDays: '' });
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({ minScore: '', keyword: '', lastNDays: '' });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchPortals();
    fetchPatterns();
    fetchFollowups();
    fetchStories();
    fetchStats();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchStats = async () => {
    try {
      const data = await getCareerOpsStats();
      setStats(data);
    } catch {
      // noop
    }
  };

  const fetchPortals = async () => {
    try {
      const data = await listCareerOpsPortals();
      setPortals(data.portals || []);
    } catch {
      // noop
    }
  };

  const fetchPatterns = async () => {
    try {
      const data = await getCareerOpsPatterns();
      setPatterns(data);
    } catch {
      // noop
    }
  };

  const fetchFollowups = async () => {
    try {
      const data = await listCareerOpsFollowups();
      setFollowups(data.followups || []);
    } catch {
      // noop
    }
  };

  const fetchStories = async () => {
    try {
      const data = await getCareerOpsStoryBank();
      setStories(data.stories || []);
    } catch {
      // noop
    }
  };

  const handleAddPortal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortalName || !newPortalUrl) return;
    try {
      await createCareerOpsPortal({ name: newPortalName, careers_url: newPortalUrl });
      setNewPortalName('');
      setNewPortalUrl('');
      fetchPortals();
      showToast('Portal added successfully', 'success');
    } catch {
      showToast('Failed to add portal', 'error');
    }
  };

  const handleDeletePortal = async (id: number) => {
    try {
      await deleteCareerOpsPortal(id);
      fetchPortals();
      showToast('Portal deleted', 'success');
    } catch {
      showToast('Failed to delete portal', 'error');
    }
  };

  const handleTogglePortal = async (p: Portal) => {
    if (!p.id) return;
    try {
      await updateCareerOpsPortal(p.id, { enabled: !p.enabled });
      fetchPortals();
    } catch {
      showToast('Failed to toggle portal', 'error');
    }
  };

  const handleTriggerScan = async () => {
    setIsScanning(true);
    try {
      const data = await scanCareerOpsPortals();
      setScanResult(data.jobs || []);
      showToast('Scan completed', 'success');
    } catch {
      showToast('Scan failed', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleActionFollowup = async (appId: string) => {
    try {
      await actionCareerOpsFollowup(appId, { contact: followupContact, notes: followupNotes });
      setSendingFollowupId(null);
      setFollowupContact('');
      setFollowupNotes('');
      fetchFollowups();
      showToast('Follow-up recorded', 'success');
    } catch {
      showToast('Failed to record follow-up', 'error');
    }
  };

  const handleAddStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoryReq || !newStoryS || !newStoryT || !newStoryA || !newStoryR) return;
    const updated = [
      ...stories,
      {
        requirement: newStoryReq,
        situation: newStoryS,
        task: newStoryT,
        action: newStoryA,
        result: newStoryR,
        reflection: newStoryRef
      }
    ];
    try {
      await saveCareerOpsStoryBank(updated);
      setNewStoryReq('');
      setNewStoryS('');
      setNewStoryT('');
      setNewStoryA('');
      setNewStoryR('');
      setNewStoryRef('');
      fetchStories();
      showToast('Story saved', 'success');
    } catch {
      showToast('Failed to save story', 'error');
    }
  };

  const handleDeleteStory = async (idx: number) => {
    try {
      await deleteCareerOpsStoryBank(idx);
      fetchStories();
      showToast('Story deleted', 'success');
    } catch {
      showToast('Failed to delete story', 'error');
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'overdue':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'cold':
        return 'text-slate-400 bg-slate-800 border-slate-700';
      default:
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    }
  };

  const applyFiltersToResults = () => {
    const f = appliedFilters;
    let results = [...scanResult];
    if (f.minScore) {
      const min = parseFloat(f.minScore);
      if (!isNaN(min)) results = results.filter((j: any) => (j.score || 0) >= min);
    }
    if (f.keyword) {
      const kw = f.keyword.toLowerCase();
      results = results.filter((j: any) =>
        (j.title || '').toLowerCase().includes(kw) ||
        (j.company || '').toLowerCase().includes(kw) ||
        (j.description || '').toLowerCase().includes(kw)
      );
    }
    if (f.lastNDays) {
      const n = parseInt(f.lastNDays, 10);
      if (!isNaN(n)) {
        const cutoff = Date.now() - n * 86400000;
        results = results.filter((j: any) => {
          if (!j.posted_date) return true;
          return new Date(j.posted_date).getTime() >= cutoff;
        });
      }
    }
    return results;
  };

  const filteredScanResult = applyFiltersToResults();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] animate-slide-in">
          <div className={`px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-600/90 text-white border border-emerald-500/30'
              : 'bg-rose-600/90 text-white border border-rose-500/30'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.message}
          </div>
        </div>
      )}

      {/* Evaluate Drawer */}
      {evaluateAppId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEvaluateAppId(null)} />
          <div className="relative w-[500px] max-w-full h-full bg-slate-900 border-l border-slate-800 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 p-4 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-200">Evaluation Report</span>
              <button onClick={() => setEvaluateAppId(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <EvaluationReportPanel applicationId={evaluateAppId} />
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-violet-300 to-indigo-100 bg-clip-text text-transparent">
            Career-Ops Command Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">Multi-agent job search orchestrator with zero-token portal scanners</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTriggerScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/10 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning Portals...' : 'Scan Portals'}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-900 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Portals</span>
            <p className="text-2xl font-extrabold text-white">{stats.total_portals}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-900 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Jobs Found</span>
            <p className="text-2xl font-extrabold text-indigo-400">{stats.total_jobs_found}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-900 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Applications</span>
            <p className="text-2xl font-extrabold text-emerald-400">{stats.total_applications}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-900 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Scans</span>
            <p className="text-2xl font-extrabold text-violet-400">{stats.active_scans}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-900 gap-1.5 p-1 bg-slate-900/30 rounded-xl max-w-lg">
        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            activeTab === 'scanner' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Portal Scanner
        </button>
        <button
          onClick={() => setActiveTab('calibration')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            activeTab === 'calibration' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Calibration
        </button>
        <button
          onClick={() => setActiveTab('followup')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            activeTab === 'followup' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Follow-up Cadence
        </button>
        <button
          onClick={() => setActiveTab('storybank')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            activeTab === 'storybank' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Story Bank
        </button>
      </div>

      {/* Main View Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* Tab Content - Scanner */}
          {activeTab === 'scanner' && (
            <div className="space-y-6">
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-indigo-400" /> Active Scanner Portals
                </h2>

                {portals.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No portals set up yet. Add a careers URL below to start scanning.</p>
                ) : (
                  <div className="divide-y divide-slate-850 border border-slate-850 rounded-xl overflow-hidden bg-slate-950/20">
                    {portals.map((p, idx) => (
                      <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-900/10">
                        <div className="flex items-center gap-3">
                          <button onClick={() => handleTogglePortal(p)} className="text-slate-400 hover:text-indigo-400 transition-colors">
                            {p.enabled ? <ToggleRight className="w-5 h-5 text-indigo-400" /> : <ToggleLeft className="w-5 h-5" />}
                          </button>
                          <div>
                            <p className="text-sm font-semibold text-slate-200">{p.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5 font-mono truncate max-w-md">{p.careers_url}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                            {p.provider}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${p.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {p.enabled ? 'Active' : 'Disabled'}
                          </span>
                          <button onClick={() => p.id && handleDeletePortal(p.id)} className="text-slate-500 hover:text-rose-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddPortal} className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-900 pt-4">
                  <input
                    type="text"
                    value={newPortalName}
                    onChange={e => setNewPortalName(e.target.value)}
                    placeholder="Company Name (e.g. Anthropic)"
                    className="p-3 bg-slate-950 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    value={newPortalUrl}
                    onChange={e => setNewPortalUrl(e.target.value)}
                    placeholder="Careers page URL"
                    className="p-3 bg-slate-950 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <button type="submit" className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-colors">
                    <Plus className="w-4 h-4" /> Add Portal
                  </button>
                </form>
              </div>

              {scanResult.length > 0 && (
                <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 space-y-4">
                  {/* Filter Panel */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                      Newly Discovered Positions ({filteredScanResult.length})
                    </h3>
                    <button
                      onClick={() => setFilterOpen(!filterOpen)}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition-colors"
                    >
                      <Filter className="w-3.5 h-3.5" /> Filters
                    </button>
                  </div>

                  {filterOpen && (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-850 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Min Score</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="5"
                            value={filters.minScore}
                            onChange={e => setFilters({ ...filters, minScore: e.target.value })}
                            placeholder="e.g. 4.0"
                            className="w-full p-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Keyword</label>
                          <input
                            type="text"
                            value={filters.keyword}
                            onChange={e => setFilters({ ...filters, keyword: e.target.value })}
                            placeholder="e.g. machine learning"
                            className="w-full p-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Last N Days</label>
                          <input
                            type="number"
                            min="1"
                            value={filters.lastNDays}
                            onChange={e => setFilters({ ...filters, lastNDays: e.target.value })}
                            placeholder="e.g. 30"
                            className="w-full p-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setFilters({ minScore: '', keyword: '', lastNDays: '' }); setAppliedFilters({ minScore: '', keyword: '', lastNDays: '' }); }}
                          className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => setAppliedFilters({ ...filters })}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-500 transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {filteredScanResult.map((job, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-950/40 border border-slate-850 hover:border-indigo-500/30 transition-all flex justify-between items-start gap-4">
                        <div>
                          <h4 className="text-sm font-bold text-slate-200">{job.title}</h4>
                          <div className="flex gap-2.5 items-center text-xs text-slate-500 mt-1 font-medium">
                            <span className="text-slate-300 font-semibold">{job.company}</span>
                            <span>·</span>
                            <span>{job.location}</span>
                          </div>
                        </div>
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                          View JD <ChevronRight className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab Content - Calibration */}
          {activeTab === 'calibration' && patterns && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-900 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Evaluated</span>
                  <p className="text-3xl font-extrabold text-white">{patterns.total_analyzed}</p>
                </div>
                <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-900 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Funnel Conversion</span>
                  <p className="text-3xl font-extrabold text-white">
                    {patterns.total_analyzed > 0 ? `${Math.round(((patterns.outcomes?.positive || 0) / patterns.total_analyzed) * 100)}%` : '0%'}
                  </p>
                </div>
                <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-900 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Positive Avg Score</span>
                  <p className="text-3xl font-extrabold text-emerald-400">{patterns.score_averages?.positive || 0.0}/5</p>
                </div>
              </div>

              {/* Funnel Chart */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <PieChart className="w-4.5 h-4.5 text-indigo-400" /> Application Funnel
                </h3>
                <div className="space-y-3">
                  <FunnelStage label="Applications" pct={100} color="linear-gradient(90deg, #6366f1, #8b5cf6)" />
                  <FunnelStage label="Screened" pct={68} color="linear-gradient(90deg, #8b5cf6, #a855f7)" />
                  <FunnelStage label="Interview" pct={42} color="linear-gradient(90deg, #a855f7, #d946ef)" />
                  <FunnelStage label="Offer" pct={18} color="linear-gradient(90deg, #d946ef, #ec4899)" />
                  <FunnelStage label="Acceptance" pct={9} color="linear-gradient(90deg, #ec4899, #f43f5e)" />
                </div>
              </div>

              {patterns.recommendations && patterns.recommendations.length > 0 && (
                <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <PieChart className="w-4.5 h-4.5 text-indigo-400" /> Data-Driven Targeting Recommendations
                  </h3>
                  <div className="space-y-3">
                    {patterns.recommendations.map((rec: any, idx: number) => (
                      <div key={idx} className="p-4 rounded-xl border border-indigo-500/10 bg-indigo-500/5 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-white">{rec.action}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 uppercase tracking-wider">
                            {rec.impact} Impact
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{rec.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab Content - Follow-up */}
          {activeTab === 'followup' && (
            <div className="space-y-6">
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-400" /> Follow-up Cadence Tracker
                </h2>

                {followups.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No applications currently require follow-up actions.</p>
                ) : (
                  <div className="space-y-4">
                    {followups.map((f, idx) => (
                      <div key={idx} className="p-5 rounded-2xl border border-slate-850 bg-slate-950/20 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <h3 className="text-sm font-bold text-slate-200">{f.role}</h3>
                            <p className="text-xs text-slate-400">{f.company} · {f.age_days} days active</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getUrgencyColor(f.urgency)}`}>
                              {f.urgency}
                            </span>
                            <button
                              onClick={() => setEvaluateAppId(f.application_id)}
                              className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-indigo-500/20 text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors"
                            >
                              Evaluate
                            </button>
                          </div>
                        </div>

                        {f.draft_body && (
                          <div className="space-y-2.5">
                            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-2">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Voice DNA Follow-up Draft</span>
                              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                                {f.draft_body}
                              </pre>
                            </div>

                            {sendingFollowupId === f.application_id ? (
                              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 space-y-3">
                                <input
                                  type="text"
                                  placeholder="Recipient name / email"
                                  value={followupContact}
                                  onChange={e => setFollowupContact(e.target.value)}
                                  className="w-full p-2.5 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                                />
                                <textarea
                                  placeholder="Follow-up notes (e.g. Sent via email)"
                                  value={followupNotes}
                                  onChange={e => setFollowupNotes(e.target.value)}
                                  className="w-full p-2.5 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500 h-20"
                                />
                                <div className="flex gap-2 justify-end">
                                  <button onClick={() => setSendingFollowupId(null)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">
                                    Cancel
                                  </button>
                                  <button onClick={() => handleActionFollowup(f.application_id)} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold">
                                    <Check className="w-3.5 h-3.5" /> Confirm Sent
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setSendingFollowupId(f.application_id)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                              >
                                <Send className="w-3.5 h-3.5" /> Record follow-up sent
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Content - Story Bank */}
          {activeTab === 'storybank' && (
            <div className="space-y-6">
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-400" /> STAR+Reflection Story Bank
                </h2>

                {stories.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No stories saved in the story bank yet.</p>
                ) : (
                  <div className="space-y-4">
                    {stories.map((st, idx) => (
                      <div key={idx} className="p-4 rounded-xl border border-slate-850 bg-slate-950/20 space-y-3 relative">
                        <button
                          onClick={() => handleDeleteStory(idx)}
                          className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="border-b border-slate-850 pb-2">
                          <span className="text-xs font-bold text-slate-300">Requirement: {st.requirement}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="space-y-2">
                            <p className="text-slate-400"><strong className="text-indigo-400 uppercase tracking-wider text-[10px]">Situation:</strong> {st.situation}</p>
                            <p className="text-slate-400"><strong className="text-indigo-400 uppercase tracking-wider text-[10px]">Task:</strong> {st.task}</p>
                            <p className="text-slate-400"><strong className="text-indigo-400 uppercase tracking-wider text-[10px]">Action:</strong> {st.action}</p>
                            <p className="text-slate-400"><strong className="text-indigo-400 uppercase tracking-wider text-[10px]">Result:</strong> {st.result}</p>
                          </div>
                          <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg space-y-1">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">STAR Reflection</span>
                            <p className="text-slate-300 leading-relaxed italic">"{st.reflection}"</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddStory} className="border-t border-slate-900 pt-5 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Add New STAR+R Story</h3>
                  <input
                    type="text"
                    value={newStoryReq}
                    onChange={e => setNewStoryReq(e.target.value)}
                    placeholder="JD Requirement / Topic (e.g. Scaling multi-node pipelines)"
                    className="w-full p-3 bg-slate-950 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <textarea
                      value={newStoryS}
                      onChange={e => setNewStoryS(e.target.value)}
                      placeholder="Situation (S)"
                      className="p-3 bg-slate-950 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-indigo-500 h-20"
                    />
                    <textarea
                      value={newStoryT}
                      onChange={e => setNewStoryT(e.target.value)}
                      placeholder="Task (T)"
                      className="p-3 bg-slate-950 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-indigo-500 h-20"
                    />
                    <textarea
                      value={newStoryA}
                      onChange={e => setNewStoryA(e.target.value)}
                      placeholder="Action (A)"
                      className="p-3 bg-slate-950 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-indigo-500 h-20"
                    />
                    <textarea
                      value={newStoryR}
                      onChange={e => setNewStoryR(e.target.value)}
                      placeholder="Result (R)"
                      className="p-3 bg-slate-950 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-indigo-500 h-20"
                    />
                  </div>
                  <textarea
                    value={newStoryRef}
                    onChange={e => setNewStoryRef(e.target.value)}
                    placeholder="Reflection (R - Lessons learned, key takeaways)"
                    className="w-full p-3 bg-slate-950 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-indigo-500 h-20"
                  />
                  <button type="submit" className="w-full flex items-center justify-center gap-1.5 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-colors">
                    <Plus className="w-4 h-4" /> Save Story
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info Panels */}
        <div className="space-y-6">
          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4.5 h-4.5 text-indigo-400" /> Career-Ops Rules
            </h3>
            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-850">
                <p className="font-semibold text-slate-200">1. Score Floor Guard</p>
                <p className="text-slate-400 mt-1">Applications scoring below 4.0/5.0 should be filtered out to preserve candidate energy.</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-850">
                <p className="font-semibold text-slate-200">2. Active Legitimacy Gating</p>
                <p className="text-slate-400 mt-1">Ghost jobs are identified by missing technical specifics or company layoff context.</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-850">
                <p className="font-semibold text-slate-200">3. Conversational Voice DNA</p>
                <p className="text-slate-400 mt-1">Follow-ups avoid "just checking in" clichés and are loaded with metric receipts.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default CareerOpsDashboard;
