import { analyzeProjectActivity } from './trackerAgent';
import { analyzeProjectSpending } from './spendingAgent';
import { evaluateMilestoneProof } from './milestoneAgent';
import {
  TrackerInput,
  SpendingInput,
  MilestoneInput,
  OrchestrationResult,
} from './types';

export interface OrchestrationInput {
  projectId: string;
  trackerInput: TrackerInput;
  spendingInput: SpendingInput;
  milestonesInput: MilestoneInput[];
}

/**
 * SciAgent Orchestrator Agent
 * Executes multi-agent analysis suite across tracker, spending, and milestones,
 * and synthesizes an overall protocol health assessment.
 */
export function runOrchestration(input: OrchestrationInput): OrchestrationResult {
  const { projectId, trackerInput, spendingInput, milestonesInput } = input;

  const tracker = analyzeProjectActivity(trackerInput);
  const spending = analyzeProjectSpending(spendingInput);
  const milestones = milestonesInput.map((m) => evaluateMilestoneProof(m));

  // Compute composite overall health score
  const milestoneScore =
    milestones.length > 0
      ? Math.round(milestones.reduce((acc, m) => acc + m.verificationScore, 0) / milestones.length)
      : 70;

  const overallHealthScore = Math.round(
    tracker.activityScore * 0.35 + spending.healthScore * 0.4 + milestoneScore * 0.25
  );

  let summary = `Project Health Index: ${overallHealthScore}/100. `;
  if (overallHealthScore >= 75) {
    summary += 'Project demonstrates strong research activity, healthy treasury spending, and verified milestone progress.';
  } else if (overallHealthScore >= 50) {
    summary += 'Project health is moderate. Review recommendations to improve activity frequency and spending alignment.';
  } else {
    summary += 'Project health requires attention. Low research activity or elevated spending risk detected.';
  }

  return {
    projectId,
    overallHealthScore,
    tracker,
    spending,
    milestones,
    summary,
    processedAt: new Date().toISOString(),
  };
}
