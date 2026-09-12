export type AgentType = 'tracker' | 'spending' | 'milestone' | 'orchestrator';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface AgentTask<T = any> {
  id: string;
  type: AgentType;
  projectId: string;
  payload: T;
  createdAt: string;
  status: TaskStatus;
  result?: any;
  error?: string;
}

export interface TrackerInput {
  projectId: string;
  logsCount: number;
  lastLogTimestampMs?: number;
  collaboratorsCount: number;
  currentState: string;
}

export interface TrackerOutput {
  projectId: string;
  activityScore: number; // 0 - 100
  activityStatus: 'active' | 'stale' | 'dormant';
  recommendations: string[];
  analyzedAt: string;
}

export interface SpendingInput {
  projectId: string;
  treasuryBalanceWei: string;
  totalExpensesWei: string;
  pendingExpensesCount: number;
  unreconciledCount: number;
}

export interface SpendingOutput {
  projectId: string;
  burnRateRisk: 'low' | 'medium' | 'high';
  reconciliationNeeded: boolean;
  advisory: string;
  healthScore: number; // 0 - 100
  analyzedAt: string;
}

export interface MilestoneInput {
  milestoneId: string;
  projectId: string;
  title: string;
  descriptionUri: string;
  proofUri?: string | null;
  state: string;
}

export interface MilestoneOutput {
  milestoneId: string;
  projectId: string;
  proofValid: boolean;
  verificationScore: number; // 0 - 100
  status: 'verified' | 'needs_more_proof' | 'invalid_format';
  reasoning: string;
  reviewedAt: string;
}

export interface OrchestrationResult {
  projectId: string;
  overallHealthScore: number; // 0 - 100
  tracker: TrackerOutput;
  spending: SpendingOutput;
  milestones: MilestoneOutput[];
  summary: string;
  processedAt: string;
}
