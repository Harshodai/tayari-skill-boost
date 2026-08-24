import React, { useState } from 'react';
import { Play, Terminal, Cpu, Globe, CheckCircle, AlertCircle, Loader2, Users, Brain, ShieldAlert, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface SwarmResult {
  subagent: string;
  role: string;
  task: string;
  status: string;
  output: string;
}

interface Step {
  step: number;
  thought: string;
  action: string;
  code?: string;
  result?: any;
  swarm_output?: SwarmResult[];
  mcp_output?: any;
  plan?: string[];
}

interface AgentRunResponse {
  status: string;
  goal: string;
  total_steps: number;
  plan: string[];
  steps: Step[];
  memory_summary?: {
    total_episodes: number;
    successful_episodes: number;
    failed_episodes: number;
    total_reflections: number;
    semantic_keys: string[];
  };
  swarm_execution?: SwarmResult[];
}

import { apiFetch } from '@/api';

export const AgentConsole: React.FC = () => {
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentData, setAgentData] = useState<AgentRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;

    setLoading(true);
    setError(null);
    setAgentData(null);

    try {
      const resJson = await apiFetch<any>('/v1/ai/agent/run', {
        method: 'POST',
        body: JSON.stringify({ goal, max_steps: 5 })
      });

      if (resJson && resJson.success) {
        setAgentData(resJson.data);
      } else {
        throw new Error(resJson?.detail || 'Agent execution failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to execute agent task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      <Card className="border-2 shadow-xl bg-slate-950 text-slate-100">
        <CardHeader className="bg-gradient-to-r from-slate-900 via-primary/10 to-slate-900 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <Cpu className="w-8 h-8 text-emerald-400 animate-pulse" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Enterprise Generalist Agent System <Sparkles className="w-5 h-5 text-amber-400" />
                </CardTitle>
                <p className="text-xs text-slate-400">Claude Cowork + Manus AI + Subagent Swarm + Reflection Engine</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Badge variant="outline" className="border-emerald-500/50 bg-emerald-950/40 text-emerald-300">
                CodeAct REPL: Active
              </Badge>
              <Badge variant="outline" className="border-accent/50 bg-accent/10 text-accent">
                Subagent Swarm: 4 Workers
              </Badge>
              <Badge variant="outline" className="border-blue-500/50 bg-blue-950/40 text-blue-300">
                MCP Tools: Online
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleRunAgent} className="flex gap-3">
            <Input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Enter complex goal e.g., 'Deploy multi-agent research swarm and execute Python CodeAct calculations...'"
              className="flex-1 bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !goal.trim()} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Orchestrating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" /> Launch Swarm Goal
                </>
              )}
            </Button>
          </form>

          {error && (
            <div className="mt-4 p-4 rounded-lg bg-red-950/60 border border-red-800 text-red-300 flex items-center gap-2 text-xs">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {agentData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Swarm & Memory Summary */}
          <div className="space-y-6 lg:col-span-1">
            <Card className="border border-slate-800 bg-slate-900/60 text-slate-200">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-400">
                  <Users className="w-4 h-4" /> Subagent Swarm Execution
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {agentData.swarm_execution?.map((sw, idx) => (
                  <div key={idx} className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-100">
                      <span>{sw.subagent}</span>
                      <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px]">
                        {sw.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400">{sw.task}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {agentData.memory_summary && (
              <Card className="border border-slate-800 bg-slate-900/60 text-slate-200">
                <CardHeader className="pb-3 border-b border-slate-800">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-accent">
                    <Brain className="w-4 h-4" /> Agent Cognitive Memory
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Total Episodes</div>
                    <div className="text-lg font-bold text-emerald-400">{agentData.memory_summary.total_episodes}</div>
                  </div>
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Self-Reflections</div>
                    <div className="text-lg font-bold text-amber-400">{agentData.memory_summary.total_reflections}</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Execution Log */}
          <Card className="lg:col-span-2 border border-slate-800 bg-slate-900/60 text-slate-200">
            <CardHeader className="border-b border-slate-800">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-400">
                <Terminal className="w-4 h-4" /> Live Perceive-Plan-Perform Execution Log
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 max-h-[700px] overflow-y-auto font-mono text-xs">
              {agentData.steps?.map((st) => (
                <div key={st.step} className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-emerald-400 font-bold">Step {st.step}: {st.action}</span>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-300 text-[10px]">Verified</Badge>
                  </div>
                  <p className="text-slate-400 italic text-[11px]"> Thought: {st.thought}</p>
                  
                  {st.code && (
                    <div className="bg-black p-3 rounded border border-slate-800 text-emerald-300">
                      <div className="text-[10px] text-slate-500 uppercase mb-1"># Executable Code Action (CodeAct)</div>
                      <pre className="whitespace-pre-wrap">{st.code}</pre>
                    </div>
                  )}

                  {st.result && (
                    <div className="bg-slate-900 p-3 rounded border border-slate-800 text-slate-300">
                      <div className="text-[10px] text-slate-500 uppercase mb-1"># Execution Result / Reflection Diagnosis</div>
                      <pre className="whitespace-pre-wrap">{JSON.stringify(st.result, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AgentConsole;
