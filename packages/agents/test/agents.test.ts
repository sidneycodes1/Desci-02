import { describe, expect, it } from 'vitest';
import {
  analyzeProjectActivity,
  analyzeProjectSpending,
  evaluateMilestoneProof,
  runOrchestration,
  agentTaskQueue,
} from '../src';
import type { TrackerInput, TrackerOutput } from '../src';

describe('SciAgent AI Agents Suite', () => {
  describe('Tracker Agent', () => {
    it('computes high activity score for active projects with recent logs', () => {
      const result = analyzeProjectActivity({
        projectId: 'proj-1',
        logsCount: 6,
        lastLogTimestampMs: Date.now() - 2 * 24 * 60 * 60 * 1000,
        collaboratorsCount: 3,
        currentState: 'active',
      });

      expect(result.activityScore).toBeGreaterThanOrEqual(70);
      expect(result.activityStatus).toBe('active');
      expect(result.projectId).toBe('proj-1');
    });

    it('computes low activity score and recommendations for dormant projects', () => {
      const result = analyzeProjectActivity({
        projectId: 'proj-2',
        logsCount: 0,
        collaboratorsCount: 1,
        currentState: 'active',
      });

      expect(result.activityScore).toBeLessThan(50);
      expect(result.activityStatus).toBe('dormant');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Spending Agent', () => {
    it('evaluates healthy spending when expenses are within balance', () => {
      const result = analyzeProjectSpending({
        projectId: 'proj-1',
        treasuryBalanceWei: '10000000000000000000',
        totalExpensesWei: '2000000000000000000',
        pendingExpensesCount: 0,
        unreconciledCount: 0,
      });

      expect(result.healthScore).toBeGreaterThanOrEqual(70);
      expect(result.burnRateRisk).toBe('low');
      expect(result.reconciliationNeeded).toBe(false);
    });

    it('flags high burn rate risk when expenses exceed treasury balance', () => {
      const result = analyzeProjectSpending({
        projectId: 'proj-2',
        treasuryBalanceWei: '1000000000000000000',
        totalExpensesWei: '5000000000000000000',
        pendingExpensesCount: 1,
        unreconciledCount: 2,
      });

      expect(result.burnRateRisk).toBe('high');
      expect(result.reconciliationNeeded).toBe(true);
      expect(result.advisory).toContain('High burn rate alert');
    });
  });

  describe('Milestone Agent', () => {
    it('verifies milestone proof with valid IPFS URL', () => {
      const result = evaluateMilestoneProof({
        milestoneId: 'm-1',
        projectId: 'proj-1',
        title: 'Phase 1 Results',
        descriptionUri: 'https://ipfs.io/ipfs/QmDesc',
        proofUri: 'https://ipfs.io/ipfs/QmProof',
        state: 'submitted',
      });

      expect(result.proofValid).toBe(true);
      expect(result.verificationScore).toBeGreaterThanOrEqual(70);
      expect(result.status).toBe('verified');
    });

    it('rejects invalid proof URI format', () => {
      const result = evaluateMilestoneProof({
        milestoneId: 'm-2',
        projectId: 'proj-1',
        title: 'Phase 2 Results',
        descriptionUri: 'https://ipfs.io/ipfs/QmDesc',
        proofUri: 'invalid-url-string',
        state: 'submitted',
      });

      expect(result.proofValid).toBe(false);
      expect(result.status).toBe('invalid_format');
    });
  });

  describe('Orchestrator Agent', () => {
    it('runs multi-agent evaluation and computes composite health index', () => {
      const result = runOrchestration({
        projectId: 'proj-1',
        trackerInput: {
          projectId: 'proj-1',
          logsCount: 5,
          lastLogTimestampMs: Date.now() - 86400000,
          collaboratorsCount: 2,
          currentState: 'active',
        },
        spendingInput: {
          projectId: 'proj-1',
          treasuryBalanceWei: '10000000000000000000',
          totalExpensesWei: '1000000000000000000',
          pendingExpensesCount: 0,
          unreconciledCount: 0,
        },
        milestonesInput: [
          {
            milestoneId: 'm-1',
            projectId: 'proj-1',
            title: 'Initial Milestone',
            descriptionUri: 'https://ipfs.io/ipfs/QmDesc',
            proofUri: 'https://ipfs.io/ipfs/QmProof',
            state: 'submitted',
          },
        ],
      });

      expect(result.projectId).toBe('proj-1');
      expect(result.overallHealthScore).toBeGreaterThan(70);
      expect(result.summary).toContain('Health Index');
      expect(result.tracker.activityStatus).toBe('active');
    });
  });

  describe('Agent Task Queue System', () => {
    it('enqueues and processes tasks with registered worker handler', async () => {
      agentTaskQueue.registerHandler('tracker', async (task) => {
        return analyzeProjectActivity(task.payload as TrackerInput);
      });

      const task = await agentTaskQueue.enqueue({
        type: 'tracker',
        projectId: 'proj-queue-1',
        payload: {
          projectId: 'proj-queue-1',
          logsCount: 4,
          collaboratorsCount: 2,
          currentState: 'active',
        },
      });

      expect(task.id).toBeDefined();
      expect(task.status).toBe('pending');

      // Allow async queue loop to execute
      await new Promise((resolve) => setTimeout(resolve, 50));

      const processedTask = await agentTaskQueue.getTask(task.id);
      expect(processedTask?.status).toBe('completed');
      expect((processedTask?.result as TrackerOutput | undefined)?.activityScore).toBeGreaterThan(
        0
      );
    });
  });
});
