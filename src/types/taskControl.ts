export type TaskControlMode = 'desktop' | 'extension' | 'web';
export type TaskRiskTier = 'read' | 'navigation' | 'draft' | 'sensitive' | 'external_write' | 'submission';
export interface TaskApprovalState { taskId: string; proposalId?: string; riskTier: TaskRiskTier; requiresHuman: boolean; approved: boolean; }
export interface TaskControlSnapshot { taskId: string; status: string; mode: TaskControlMode; planApproved: boolean; pendingApprovals: number; takeoverAvailable: boolean; stopAvailable: boolean; }
