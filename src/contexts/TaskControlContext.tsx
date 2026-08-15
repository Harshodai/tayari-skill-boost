import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { approveAction, approveTaskPlan, denyAction, getTask, listActionProposals, listTaskEvents, pauseTask, rejectTaskPlan, requestTakeover, resumeTask, stopTask, type ActionProposal, type TaskEvent, type TaskRun } from '@/api/tasks';

type TaskControlValue = { task: TaskRun | null; events: TaskEvent[]; actions: ActionProposal[]; refresh: () => Promise<void>; approvePlan: () => Promise<void>; rejectPlan: () => Promise<void>; approveAction: (id: string) => Promise<void>; denyAction: (id: string) => Promise<void>; pause: () => Promise<void>; resume: () => Promise<void>; takeover: () => Promise<void>; stop: () => Promise<void>; };
const TaskControlContext = createContext<TaskControlValue | undefined>(undefined);
export function TaskControlProvider({ taskId, children }: { taskId?: string; children: ReactNode }) {
  const [task, setTask] = useState<TaskRun | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [actions, setActions] = useState<ActionProposal[]>([]);
  const refresh = async () => {
    if (!taskId) return;
    const [nextTask, nextEvents, nextActions] = await Promise.all([getTask(taskId), listTaskEvents(taskId), listActionProposals(taskId)]);
    setTask(nextTask); setEvents(nextEvents.events); setActions(nextActions.actions);
  };
  useEffect(() => { void refresh(); if (!taskId) return; const timer = window.setInterval(() => void refresh(), 4000); return () => window.clearInterval(timer); }, [taskId]);
  const value = useMemo<TaskControlValue>(() => {
    if (!taskId) throw new Error('TaskControlProvider requires taskId.');
    const reload = async (operation: () => Promise<unknown>) => { await operation(); await refresh(); };
    return { task, events, actions, refresh, approvePlan: () => reload(() => approveTaskPlan(taskId)), rejectPlan: () => reload(() => rejectTaskPlan(taskId)), approveAction: (id) => reload(() => approveAction(taskId, id)), denyAction: (id) => reload(() => denyAction(taskId, id)), pause: () => reload(() => pauseTask(taskId)), resume: () => reload(() => resumeTask(taskId)), takeover: () => reload(() => requestTakeover(taskId)), stop: () => reload(() => stopTask(taskId)) };
  }, [taskId, task, events, actions]);
  return <TaskControlContext.Provider value={value}>{children}</TaskControlContext.Provider>;
}
export function useTaskControl() { const value = useContext(TaskControlContext); if (!value) throw new Error('useTaskControl must be used within TaskControlProvider'); return value; }
