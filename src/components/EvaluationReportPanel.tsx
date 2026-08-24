import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, Award, Target, Zap, DollarSign, ListTodo, FileText } from 'lucide-react';

interface EvaluationReportPanelProps {
  report: Record<string, any>;
  onClose?: () => void;
}

export const EvaluationReportPanel: React.FC<EvaluationReportPanelProps> = ({ report, onClose }) => {
  const blockA = report.block_a || {};
  const blockB = report.block_b || {};
  const blockC = report.block_c || {};
  const blockD = report.block_d || {};
  const blockE = report.block_e || {};
  const blockF = report.block_f || {};
  const blockG = report.block_g || {};

  const getLegitimacyBadge = (tier: string) => {
    switch (tier) {
      case 'High Confidence':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> High Confidence
          </span>
        );
      case 'Proceed with Caution':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Proceed with Caution
          </span>
        );
      case 'Suspicious':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Suspicious
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20 gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" /> Unknown
          </span>
        );
    }
  };

  const getWeightBadge = (weight: string) => {
    switch (weight) {
      case 'Positive':
        return <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Positive</span>;
      case 'Concerning':
        return <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Concerning</span>;
      default:
        return <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Neutral</span>;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-primary/10 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-tight">Career-Ops Agent Evaluation</h2>
            {report.archetype && (
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                {report.archetype} Archetype
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">Structured 7-block AI compatibility analysis & legitimacy scorecard</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-sm">
            Close
          </button>
        )}
      </div>

      <div className="p-6 space-y-8 max-h-[80vh] overflow-y-auto">
        {/* Block G: Legitimacy Scorecard (Featured First) */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/50">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" /> Block G: Posting Legitimacy Assessment
              </h3>
              <p className="text-xs text-slate-500 mt-1">Rule-based legitimacy signals and company hiring freeze context.</p>
            </div>
            {getLegitimacyBadge(blockG.legitimacy_tier)}
          </div>
          
          {blockG.context_notes && (
            <p className="text-sm text-slate-300 mt-3 italic">"{blockG.context_notes}"</p>
          )}

          {blockG.signals && blockG.signals.length > 0 && (
            <div className="mt-4 border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 font-medium">
                  <tr>
                    <th className="px-4 py-2">Signal Checked</th>
                    <th className="px-4 py-2">Finding</th>
                    <th className="px-4 py-2 text-right">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {blockG.signals.map((sig: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="px-4 py-2.5 font-medium text-slate-200">{sig.signal}</td>
                      <td className="px-4 py-2.5 text-slate-400">{sig.finding}</td>
                      <td className="px-4 py-2.5 text-right">{getWeightBadge(sig.weight)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Block A: Role Summary */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Block A: Role Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/30 border border-slate-850">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Domain</span>
              <p className="text-sm font-medium text-slate-200 mt-0.5">{blockA.domain || 'N/A'}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/30 border border-slate-850">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Function</span>
              <p className="text-sm font-medium text-slate-200 mt-0.5">{blockA.function || 'N/A'}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/30 border border-slate-850">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Seniority</span>
              <p className="text-sm font-medium text-slate-200 mt-0.5">{blockA.seniority || 'N/A'}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/30 border border-slate-850">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remote Policy</span>
              <p className="text-sm font-medium text-slate-200 mt-0.5">{blockA.remote || 'N/A'}</p>
            </div>
          </div>
          {blockA.tldr && (
            <p className="text-sm text-slate-300 bg-slate-950/20 p-3.5 rounded-xl border border-slate-850 italic">
              "<strong>TL;DR:</strong> {blockA.tldr}"
            </p>
          )}
        </div>

        {/* Block B: Match with CV */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" /> Block B: Match with CV
          </h3>
          
          {blockB.mappings && blockB.mappings.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400">Competency Mapping:</span>
              <div className="space-y-2">
                {blockB.mappings.map((m: any, idx: number) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-950/30 border border-slate-850 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Requirement</span>
                      <p className="text-sm text-slate-200 font-medium mt-0.5">{m.requirement}</p>
                    </div>
                    <div className="md:w-1/2 border-t md:border-t-0 md:border-l border-slate-800 md:pl-4 pt-2 md:pt-0">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">CV Match</span>
                      <p className="text-sm text-slate-300 mt-0.5 italic">"{m.cv_mapping}"</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {blockB.gaps && blockB.gaps.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400">Identified Gaps & Mitigation:</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {blockB.gaps.map((g: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-xl border border-rose-500/10 bg-rose-500/5 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-rose-300">{g.gap}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        g.importance === 'Hard blocker' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-400'
                      }`}>{g.importance}</span>
                    </div>
                    <p className="text-xs text-slate-300"><strong className="text-emerald-400">Mitigation:</strong> {g.mitigation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Block C: Level & Strategy */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Award className="w-4 h-4 text-teal-400" /> Block C: Leveling & Strategy
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-slate-950/30 border border-slate-850 space-y-1">
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">Leveling Status</span>
              <p className="text-xs text-slate-300 leading-relaxed">{blockC.level_detected || 'No level discrepancy detected.'}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/30 border border-slate-850 space-y-1">
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">"Sell Senior" Plan</span>
              <p className="text-xs text-slate-300 leading-relaxed">{blockC.sell_senior_plan || 'N/A'}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/30 border border-slate-850 space-y-1">
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">Downlevel Mitigation</span>
              <p className="text-xs text-slate-300 leading-relaxed">{blockC.downlevel_plan || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Block D & Block E */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Block D: Compensation */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" /> Block D: Comp & Demand
            </h3>
            <div className="p-4 rounded-xl bg-slate-950/30 border border-slate-850 space-y-3">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estimated Salary / OTE</span>
                <p className="text-sm font-medium text-slate-200 mt-0.5">{blockD.comp_estimate || 'Not specified'}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Market Demand Trend</span>
                <p className="text-xs text-slate-300 leading-relaxed mt-0.5">{blockD.demand_trend || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Block E: Customization Plan */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-pink-400" /> Block E: CV Customization Plan
            </h3>
            <div className="p-4 rounded-xl bg-slate-950/30 border border-slate-850 space-y-3">
              {blockE.cv_changes && blockE.cv_changes.length > 0 ? (
                <div className="space-y-2">
                  {blockE.cv_changes.map((ch: any, idx: number) => (
                    <div key={idx} className="text-xs space-y-1">
                      <span className="font-semibold text-pink-400">{ch.section}:</span>
                      <p className="text-slate-300 italic">"Proposed: {ch.proposed}"</p>
                      <p className="text-[10px] text-slate-500">Reason: {ch.reason}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No customization required. Standard CV has high compatibility.</p>
              )}
            </div>
          </div>
        </div>

        {/* Block F: STAR+R Stories */}
        {blockF.stories && blockF.stories.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" /> Block F: Mapped STAR+R Stories
            </h3>
            <div className="space-y-3">
              {blockF.stories.map((st: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-950/30 border border-slate-850 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                    <span className="text-xs font-bold text-slate-400">Requirement: {st.requirement}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-2">
                      <p className="text-slate-300"><strong>Situation:</strong> {st.situation}</p>
                      <p className="text-slate-300"><strong>Task:</strong> {st.task}</p>
                      <p className="text-slate-300"><strong>Action:</strong> {st.action}</p>
                      <p className="text-slate-300"><strong>Result:</strong> {st.result}</p>
                    </div>
                    <div className="p-3.5 rounded-lg bg-primary/5 border border-primary/10 space-y-1">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider">STAR Reflection</span>
                      <p className="text-slate-300 leading-relaxed italic">"{st.reflection}"</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cover Letter Draft */}
        {report.cover_letter_draft && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" /> Auto-Generated Cover Letter Draft
            </h3>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-850 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed shadow-inner">
              {report.cover_letter_draft}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
