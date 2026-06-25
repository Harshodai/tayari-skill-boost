import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Users,
  Terminal,
  Play,
  Settings,
  Plus,
  Trash2,
  Copy,
  Check,
  CheckCircle,
  Cpu,
  Brain,
  ShieldAlert,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface Agent {
  employee_id?: string;
  name: string;
  role: string;
  remark_name?: string;
  instructions?: string;
  traits: string[];
  active: boolean;
  runtime_id?: string;
}

interface AgentTask {
  task_id: string;
  agent_id: string;
  title: string;
  status: string;
  input_json?: Record<string, unknown>;
  result_json?: Record<string, unknown>;
  error_text?: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentEvent {
  event_id: string;
  task_id: string;
  type: string;
  summary: string;
  payload_json?: Record<string, unknown>;
  created_at: string;
}

export default function AgentPanel() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [configYaml, setConfigYaml] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"board" | "hermes">("board");

  // New agent form
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Agent");
  const [remarkName, setRemarkName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [traits, setTraits] = useState("");
  const [runtimeId, setRuntimeId] = useState("default");

  // Task execution states
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [showRunTaskForm, setShowRunTaskForm] = useState(false);
  const [selectedAgentForTask, setSelectedAgentForTask] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [taskEvents, setTaskEvents] = useState<AgentEvent[]>([]);
  const [approvalComment, setApprovalComment] = useState("");
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const token = localStorage.getItem("auth_token");
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/v1/agents/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [API_URL, token]);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/v1/agents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch agents");
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load digital employees");
    } finally {
      setLoading(false);
    }
  }, [API_URL, token]);

  const fetchHermesConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/v1/hermes/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConfigYaml(data.config_yaml || "");
      }
    } catch (e) {
      console.error(e);
    }
  }, [API_URL, token]);

  const fetchTaskEvents = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`${API_URL}/v1/agents/tasks/${taskId}/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTaskEvents(data.events || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [API_URL, token]);

  const fetchTaskDetails = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`${API_URL}/v1/agents/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.task;
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  }, [API_URL, token]);

  useEffect(() => {
    fetchAgents();
    fetchHermesConfig();
    fetchTasks();
  }, [fetchAgents, fetchHermesConfig, fetchTasks]);

  const handleRunTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      toast.error("Task title is required");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/agents/${selectedAgentForTask}/tasks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: taskTitle.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to run task");
      const data = await res.json();
      toast.success("Task enqueued successfully");
      setShowRunTaskForm(false);
      fetchTasks();
      
      const newTask: AgentTask = {
        task_id: data.task_id,
        title: taskTitle.trim(),
        agent_id: selectedAgentForTask,
        status: "queued",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setSelectedTask(newTask);
      setTaskEvents([]);
    } catch (e) {
      toast.error("Failed to run task");
    }
  };

  useEffect(() => {
    if (!selectedTask) return;
    
    fetchTaskEvents(selectedTask.task_id);
    
    if (selectedTask.status === "queued" || selectedTask.status === "running") {
      const interval = setInterval(async () => {
        const updated = await fetchTaskDetails(selectedTask.task_id);
        if (updated) {
          setSelectedTask(updated);
          fetchTasks();
        }
        fetchTaskEvents(selectedTask.task_id);
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [selectedTask, fetchTaskEvents, fetchTaskDetails, fetchTasks]);

  const handleActionApprovalInTerminal = async (approvalId: string, status: "approved" | "rejected") => {
    setSubmittingApproval(true);
    try {
      const res = await fetch(`${API_URL}/v1/approvals/${approvalId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          reviewer_comment: approvalComment.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to action approval");
      toast.success(`Action '${status}' submitted successfully`);
      setApprovalComment("");
      
      if (selectedTask) {
        fetchTaskEvents(selectedTask.task_id);
      }
    } catch (e) {
      toast.error("Failed to action approval");
    } finally {
      setSubmittingApproval(false);
    }
  };



  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Agent name is required");
      return;
    }
    try {
      const traitList = traits.split(",").map((t) => t.trim()).filter(Boolean);
      const res = await fetch(`${API_URL}/v1/agents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          role,
          remark_name: remarkName.trim() || undefined,
          instructions: instructions.trim(),
          traits: traitList,
          active: true,
          runtime_id: runtimeId,
        }),
      });
      if (!res.ok) throw new Error("Failed to save agent");
      toast.success("Agent hired successfully");
      setShowAddForm(false);
      setName("");
      setRemarkName("");
      setInstructions("");
      setTraits("");
      fetchAgents();
    } catch (e) {
      toast.error("Failed to hire agent");
    }
  };

  const handleDeleteAgent = async (agentName: string) => {
    if (!confirm(`Are you sure you want to dismiss ${agentName}?`)) return;
    try {
      const res = await fetch(`${API_URL}/v1/agents/${agentName}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete agent");
      toast.success("Agent dismissed");
      fetchAgents();
    } catch (e) {
      toast.error("Failed to dismiss agent");
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(configYaml);
    setCopied(true);
    toast.success("Configuration copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent flex items-center gap-3">
              <Brain className="w-8 h-8 text-primary" />
              Digital Employee Board
            </h1>
            <p className="text-muted-foreground mt-1.5">
              Recruit, govern, and sync autonomous AI agents with your profile to automate job applications.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={activeTab === "board" ? "default" : "outline"}
              onClick={() => setActiveTab("board")}
              className="px-5"
            >
              <Users className="w-4 h-4 mr-2" />
              Digital Employees
            </Button>
            <Button
              variant={activeTab === "hermes" ? "default" : "outline"}
              onClick={() => setActiveTab("hermes")}
              className="px-5"
            >
              <Terminal className="w-4 h-4 mr-2" />
              Connect Hermes Desktop
            </Button>
          </div>
        </div>

        {activeTab === "board" && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Active Agents</h2>
              {!showAddForm && (
                <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Hire Digital Employee
                </Button>
              )}
            </div>

            {/* Hire Form */}
            {showAddForm && (
              <Card className="border border-primary/20 bg-muted/20 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Hire a New AI Employee</CardTitle>
                  <CardDescription>Configure instructions and persona parameters for this agent.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateAgent} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Identifier Name (Unique)</label>
                        <Input
                          placeholder="e.g. ResumeWriter"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Display Name</label>
                        <Input
                          placeholder="e.g. Professional Resume Editor"
                          value={remarkName}
                          onChange={(e) => setRemarkName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Role Category</label>
                        <Input
                          placeholder="e.g. Editor / Applied AI Scientist"
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">System Instructions</label>
                      <Textarea
                        placeholder="Define how the agent behaves and handles files/prompts..."
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Traits / Keywords (comma-separated)</label>
                        <Input
                          placeholder="precise, technical, detailed"
                          value={traits}
                          onChange={(e) => setTraits(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Bound Runtime Execution</label>
                        <select
                          value={runtimeId}
                          onChange={(e) => setRuntimeId(e.target.value)}
                          className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
                        >
                          <option value="default">Default API (OpenRouter/NVIDIA NIM)</option>
                          <option value="hermes">Nous Hermes Agent (Local CLI/Desktop)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" type="button" onClick={() => setShowAddForm(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Deploy Agent</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* List Agents */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : agents.length === 0 ? (
              <Card className="border-dashed py-12 text-center">
                <CardContent className="flex flex-col items-center justify-center">
                  <Users className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No digital employees hired yet</h3>
                  <p className="text-muted-foreground max-w-sm mt-1">
                    Hire your first AI agent to start custom tailoring and submitting resumes autonomously.
                  </p>
                  <Button className="mt-4" onClick={() => setShowAddForm(true)}>
                    Hire Employee
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {agents.map((agent) => (
                  <Card key={agent.name} className="flex flex-col justify-between card-hover border-border/80">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-xl font-bold">
                              {agent.remark_name || agent.name}
                            </CardTitle>
                            <Badge variant={agent.active ? "success" : "secondary"}>
                              {agent.active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground font-medium mt-0.5">{agent.role}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-primary hover:bg-primary/10"
                            onClick={() => {
                              setSelectedAgentForTask(agent.name);
                              setTaskTitle(`Execution run for ${agent.remark_name || agent.name}`);
                              setShowRunTaskForm(true);
                            }}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteAgent(agent.name)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {agent.instructions && (
                        <div className="text-sm bg-muted/40 p-3 rounded-md max-h-24 overflow-y-auto font-mono text-[11px] leading-relaxed">
                          {agent.instructions}
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-1">
                        {agent.traits.map((trait) => (
                          <Badge key={trait} variant="outline" className="text-[10px]">
                            {trait}
                          </Badge>
                        ))}
                      </div>

                      <div className="border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Cpu className="w-3.5 h-3.5" />
                          Runtime: <span className="font-semibold text-foreground">{agent.runtime_id || "default"}</span>
                        </span>
                        <span>Bound: {new Date().toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Task History list */}
            <Card className="border-border/80 mt-8">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" />
                  Agent Task Execution Runs
                </CardTitle>
                <CardDescription>
                  Monitor enqueued background tasks and inspect live terminal execution logs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No task runs recorded. Click "Run" on any agent card to execute a task.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse text-left">
                      <thead>
                        <tr className="border-b text-muted-foreground font-medium text-xs">
                          <th className="py-2 px-3">Task Title</th>
                          <th className="py-2 px-3">Agent</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Started</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((task) => (
                          <tr key={task.task_id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                            <td className="py-3 px-3 font-medium">{task.title}</td>
                            <td className="py-3 px-3 text-muted-foreground text-xs">{task.agent_id}</td>
                            <td className="py-3 px-3">
                              <Badge
                                variant={
                                  task.status === "success"
                                    ? "success"
                                    : task.status === "failed"
                                    ? "destructive"
                                    : task.status === "running"
                                    ? "warning"
                                    : "secondary"
                                }
                                className="text-[10px] uppercase font-bold"
                              >
                                {task.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-muted-foreground text-xs">
                              {new Date(task.created_at).toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <Button
                                size="xs"
                                variant="outline"
                                className="h-7 text-xs flex items-center gap-1.5"
                                onClick={() => {
                                  setSelectedTask(task);
                                  setTaskEvents([]);
                                }}
                              >
                                <Terminal className="w-3 h-3" />
                                Console
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "hermes" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-primary" />
                  Connect Nous Hermes Desktop Agent
                </CardTitle>
                <CardDescription>
                  Route your local desktop or CLI agent sessions directly through your Job Tayari profile.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">How it works</h3>
                  <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                    <li>Download and install the native **Hermes Desktop Application** or install the CLI (`npm install -g @nousresearch/hermes-agent`).</li>
                    <li>Synchronize settings by placing the configuration block below in your local Hermes settings file.</li>
                    <li>Every time you trigger autonomous agent workflows locally, they will securely check for job matches, apply constraints, and request human-in-the-loop approvals on your Job Tayari dashboard.</li>
                  </ol>
                </div>

                <div className="relative">
                  <div className="absolute right-3 top-3 z-10 flex gap-2">
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={copyToClipboard}>
                      {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto font-mono text-xs leading-relaxed border border-border">
                    {configYaml}
                  </pre>
                </div>

                <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">Secure Credentials</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      The generated token links your local machine to your specific user profile context. Keep this configuration secret.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Run Task Form Modal */}
      {showRunTaskForm && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-lg shadow-lg max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Play className="w-5 h-5 text-primary" />
              Trigger Agent Execution Run
            </h3>
            <p className="text-sm text-muted-foreground">
              Start a background scheduled execution task for agent <span className="font-semibold text-foreground">"{selectedAgentForTask}"</span>.
            </p>
            <form onSubmit={handleRunTask} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Task Title</label>
                <Input
                  placeholder="e.g. Check tech job listings and prepare optimized submissions"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setShowRunTaskForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" />
                  Launch Task
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Terminal Console Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-lg shadow-xl max-w-2xl w-full flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="border-b px-6 py-4 flex justify-between items-center bg-muted/30">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" />
                  {selectedTask.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Agent: <span className="font-semibold text-foreground">{selectedTask.agent_id}</span> | Status:{" "}
                  <Badge variant={selectedTask.status === "success" ? "success" : selectedTask.status === "failed" ? "destructive" : "warning"} className="text-[9px] uppercase font-bold py-0">
                    {selectedTask.status}
                  </Badge>
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedTask(null)}>
                Close Console
              </Button>
            </div>

            {/* Terminal Logs Box */}
            <div className="flex-1 overflow-y-auto p-4 bg-zinc-950 text-zinc-100 font-mono text-[11px] leading-relaxed border-b border-border/40 select-text">
              <div className="space-y-1.5">
                <div className="text-zinc-500">// Tayari Agent Terminal Console v1.0.0</div>
                <div className="text-zinc-500">// Connected to AgentRouter. Run ID: {selectedTask.task_id}</div>
                <div className="text-zinc-500">--------------------------------------------------</div>
                
                {taskEvents.length === 0 && (
                  <div className="text-zinc-500 flex items-center gap-2 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Connecting to event logger and fetching stream...
                  </div>
                )}

                {taskEvents.map((event: AgentEvent, idx: number) => {
                  const time = new Date(event.created_at).toLocaleTimeString();
                  let color = "text-zinc-300";
                  let prefix = "[INFO]";
                  
                  if (event.type === "task_started" || event.type === "step_started") {
                    color = "text-indigo-400";
                    prefix = "[SYSTEM]";
                  } else if (event.type === "step_completed") {
                    color = "text-zinc-400";
                    prefix = "[STEP]";
                  } else if (event.type === "approval_wait") {
                    color = "text-amber-500 font-semibold";
                    prefix = "[WAITING]";
                  } else if (event.type === "tool_approved") {
                    color = "text-emerald-400 font-semibold";
                    prefix = "[APPROVED]";
                  } else if (event.type === "tool_rejected") {
                    color = "text-rose-400 font-semibold";
                    prefix = "[REJECTED]";
                  } else if (event.type === "task_success") {
                    color = "text-emerald-400 font-bold";
                    prefix = "[SUCCESS]";
                  } else if (event.type === "task_failed" || event.type === "step_failed") {
                    color = "text-rose-400 font-bold";
                    prefix = "[FAILED]";
                  }
                  
                  return (
                    <div key={event.event_id || idx} className={`${color} break-all`}>
                      <span className="text-zinc-600 mr-2">{time}</span>
                      <span className="mr-2 font-bold">{prefix}</span>
                      {event.summary}
                      {event.payload_json && Object.keys(event.payload_json).length > 0 && (
                        <pre className="text-[10px] text-zinc-500 bg-zinc-900/60 p-2 rounded mt-1 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(event.payload_json, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inline Approval Center */}
            {selectedTask.status === "running" && taskEvents.some(e => e.type === "approval_wait") && (
              (() => {
                const waitEvents = taskEvents.filter(e => e.type === "approval_wait");
                const latestWait = waitEvents[waitEvents.length - 1];
                const approvalId = latestWait?.payload_json?.approval_id;
                
                const hasResponse = taskEvents.some(e => 
                  (e.type === "tool_approved" || e.type === "tool_rejected") && 
                  e.payload_json?.approval_id === approvalId
                );
                
                if (!latestWait || !approvalId || hasResponse) return null;

                return (
                  <div className="p-5 border-t bg-amber-500/5 border-amber-500/10 space-y-4">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">Critical Tool Approval Required</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Agent requires your explicit permission to execute the following tool: <span className="font-mono text-amber-600 font-bold bg-amber-500/10 px-1 rounded">{latestWait.payload_json.tool_name}</span>.
                        </p>
                        <div className="mt-2 text-xs font-mono bg-zinc-950 text-zinc-300 p-2.5 rounded border border-zinc-800">
                          {latestWait.payload_json.content_preview}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Input
                        placeholder="Optional feedback / reviewer comment..."
                        value={approvalComment}
                        onChange={(e) => setApprovalComment(e.target.value)}
                        disabled={submittingApproval}
                        className="bg-background border-border/80 text-xs"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={submittingApproval}
                          onClick={() => handleActionApprovalInTerminal(approvalId, "rejected")}
                          className="bg-background border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-600 text-rose-500 h-8"
                        >
                          Reject Call
                        </Button>
                        <Button
                          size="sm"
                          disabled={submittingApproval}
                          onClick={() => handleActionApprovalInTerminal(approvalId, "approved")}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white h-8"
                        >
                          Approve & Execute
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
