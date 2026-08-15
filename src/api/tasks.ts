import { apiFetch } from './client';

export type TaskStatus = 'draft' | 'planning' | 'awaiting_plan_approval' | 'queued' | 'running' | 'paused' | 'awaiting_action_approval' | 'awaiting_takeover' | 'completed' | 'stopped' | 'failed';
export type RiskTier = 'read' | 'navigation' | 'draft' | 'sensitive' | 'external_write' | 'submission';
export interface TaskRun { id: string; title: string; objective: string; status: TaskStatus; version: number; created_at: string; updated_at: string; stop_requested_at?: string; takeover_requested_at?: string; }
export interface TaskEvent { sequence_no: number; event_type: string; payload: Record<string, unknown>; created_at: string; }
export interface ActionProposal { id: string; task_id: string; action_type: string; risk_tier: RiskTier; site_origin?: string; payload: Record<string, unknown>; status: string; decided_at?: string; created_at: string; }
export const createTask = (input: { title: string; objective: string }) => apiFetch<TaskRun>('/v1/tasks', { method: 'POST', body: JSON.stringify(input) });
export const listTasks = () => apiFetch<{ tasks: TaskRun[] }>('/v1/tasks');
export const getTask = (id: string) => apiFetch<TaskRun>(`/v1/tasks/${encodeURIComponent(id)}`);
export const listTaskEvents = (id: string) => apiFetch<{ events: TaskEvent[] }>(`/v1/tasks/${encodeURIComponent(id)}/events`);
export const createTaskPlan = (id: string, steps: unknown[]) => apiFetch(`/v1/tasks/${encodeURIComponent(id)}/plan`, { method: 'POST', body: JSON.stringify({ steps }) });
export const approveTaskPlan = (id: string) => apiFetch<TaskRun>(`/v1/tasks/${encodeURIComponent(id)}/plan/approve`, { method: 'POST' });
export const rejectTaskPlan = (id: string) => apiFetch<TaskRun>(`/v1/tasks/${encodeURIComponent(id)}/plan/reject`, { method: 'POST' });
export const pauseTask = (id: string) => apiFetch<TaskRun>(`/v1/tasks/${encodeURIComponent(id)}/pause`, { method: 'POST' });
export const resumeTask = (id: string) => apiFetch<TaskRun>(`/v1/tasks/${encodeURIComponent(id)}/resume`, { method: 'POST' });
export const requestTakeover = (id: string) => apiFetch<TaskRun>(`/v1/tasks/${encodeURIComponent(id)}/takeover`, { method: 'POST' });
export const stopTask = (id: string) => apiFetch<TaskRun>(`/v1/tasks/${encodeURIComponent(id)}/stop`, { method: 'POST' });
export const proposeAction = (id: string, input: { action_type: string; risk_tier: RiskTier; site_origin?: string; payload?: Record<string, unknown> }) => apiFetch<ActionProposal>(`/v1/tasks/${encodeURIComponent(id)}/actions`, { method: 'POST', body: JSON.stringify(input) });
export const listActionProposals = (id: string) => apiFetch<{ actions: ActionProposal[] }>(`/v1/tasks/${encodeURIComponent(id)}/actions`);
export const approveAction = (taskId: string, actionId: string) => apiFetch<ActionProposal>(`/v1/tasks/${encodeURIComponent(taskId)}/actions/${encodeURIComponent(actionId)}/approve`, { method: 'POST' });
export const denyAction = (taskId: string, actionId: string) => apiFetch<ActionProposal>(`/v1/tasks/${encodeURIComponent(taskId)}/actions/${encodeURIComponent(actionId)}/deny`, { method: 'POST' });
