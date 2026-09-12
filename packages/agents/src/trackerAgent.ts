import { TrackerInput, TrackerOutput } from './types';

/**
 * SciAgent Tracker Agent
 * Analyzes project activity metrics, research log velocity, and update recency.
 */
export function analyzeProjectActivity(input: TrackerInput): TrackerOutput {
  const { projectId, logsCount, lastLogTimestampMs, collaboratorsCount, currentState } = input;
  const now = Date.now();

  let activityScore = 50;
  const recommendations: string[] = [];

  // Log volume contribution
  if (logsCount === 0) {
    activityScore -= 30;
    recommendations.push('No research logs submitted yet. Submit initial findings to build trust.');
  } else if (logsCount >= 5) {
    activityScore += 20;
  } else {
    activityScore += logsCount * 3;
  }

  // Recency contribution
  if (lastLogTimestampMs) {
    const daysSinceLastLog = (now - lastLogTimestampMs) / (1000 * 60 * 60 * 24);
    if (daysSinceLastLog <= 7) {
      activityScore += 20;
    } else if (daysSinceLastLog <= 30) {
      activityScore += 5;
    } else {
      activityScore -= 20;
      recommendations.push(`No research updates in ${Math.floor(daysSinceLastLog)} days. Post a status update.`);
    }
  }

  // Collaborator contribution
  if (collaboratorsCount > 1) {
    activityScore += 10;
  } else {
    recommendations.push('Consider adding research collaborators to increase protocol engagement.');
  }

  // State weighting
  if (currentState === 'active') {
    activityScore += 10;
  } else if (currentState === 'paused' || currentState === 'closed') {
    activityScore -= 20;
  }

  // Clamp score (0 - 100)
  activityScore = Math.max(0, Math.min(100, Math.round(activityScore)));

  let activityStatus: TrackerOutput['activityStatus'] = 'stale';
  if (activityScore >= 70) {
    activityStatus = 'active';
  } else if (activityScore <= 35) {
    activityStatus = 'dormant';
  }

  return {
    projectId,
    activityScore,
    activityStatus,
    recommendations,
    analyzedAt: new Date().toISOString(),
  };
}
