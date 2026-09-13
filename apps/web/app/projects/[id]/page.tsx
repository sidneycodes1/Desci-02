'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devAuthHeaders } from '../../../lib/dev-auth';

interface ProjectRecord {
  id: string;
  name: string;
  metadata_uri?: string | null;
  status: string;
  owner_user_id: string;
}

interface ResearchLogRecord {
  id: string;
  title: string;
  content: string;
  created_at?: string | null;
}

interface MilestoneRecord {
  id: string;
  title: string;
  state: string;
  proof_uri?: string | null;
}

interface ExpenseRecord {
  id: string;
  memo: string;
  recipient_address: string;
  amount_wei: string;
  status: string;
}

type WorkspaceTab = 'overview' | 'logs' | 'treasury' | 'milestones' | 'export';

export default function ProjectWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [projectId, setProjectId] = useState<string>('');
  const [userRole, setUserRole] = useState<'admin' | 'owner' | 'member' | 'viewer'>('viewer');

  React.useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  // Fetch user role for this project
  const { data: projectData } = useQuery<{
    project: ProjectRecord | null;
    userRole: 'admin' | 'owner' | 'member' | 'viewer';
  }>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return { project: null, userRole: 'viewer' as const };
      const res = await fetch(`/api/projects/${projectId}`, {
        headers: devAuthHeaders(),
      });
      if (!res.ok) return { project: null, userRole: 'viewer' as const };
      return res.json();
    },
    enabled: !!projectId,
  });

  React.useEffect(() => {
    if (projectData?.userRole) {
      setUserRole(projectData.userRole);
    }
  }, [projectData]);

  // Form States
  const [newLogTitle, setNewLogTitle] = useState('');
  const [newLogContent, setNewLogContent] = useState('');

  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDescUri, setNewMilestoneDescUri] = useState('');

  const [newExpenseRecipient, setNewExpenseRecipient] = useState('');
  const [newExpenseAmountWei, setNewExpenseAmountWei] = useState('');
  const [newExpenseMemo, setNewExpenseMemo] = useState('');

  // 1. Fetch Research Logs
  const { data: logsData } = useQuery<{ logs: ResearchLogRecord[] }>({
    queryKey: ['logs', projectId],
    queryFn: async () => {
      if (!projectId) return { logs: [] };
      const res = await fetch(`/api/projects/${projectId}/logs`, {
        headers: devAuthHeaders(),
      });
      if (!res.ok) return { logs: [] };
      return res.json();
    },
    enabled: !!projectId,
  });

  // 2. Fetch Milestones
  const { data: milestonesData } = useQuery<{ milestones: MilestoneRecord[] }>({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      if (!projectId) return { milestones: [] };
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        headers: devAuthHeaders(),
      });
      if (!res.ok) return { milestones: [] };
      return res.json();
    },
    enabled: !!projectId,
  });

  // 3. Fetch Expenses
  const { data: expensesData } = useQuery<{ expenses: ExpenseRecord[] }>({
    queryKey: ['expenses', projectId],
    queryFn: async () => {
      if (!projectId) return { expenses: [] };
      const res = await fetch(`/api/projects/${projectId}/expenses`, {
        headers: devAuthHeaders(),
      });
      if (!res.ok) return { expenses: [] };
      return res.json();
    },
    enabled: !!projectId,
  });

  // Mutations
  const createLogMutation = useMutation({
    mutationFn: async (payload: { title: string; content: string }) => {
      const res = await fetch(`/api/projects/${projectId}/logs`, {
        method: 'POST',
        headers: devAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create research log');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs', projectId] });
      setNewLogTitle('');
      setNewLogContent('');
    },
  });

  const createMilestoneMutation = useMutation({
    mutationFn: async (payload: { title: string; descriptionUri: string }) => {
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: devAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create milestone');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      setNewMilestoneTitle('');
      setNewMilestoneDescUri('');
    },
  });

  const proposeExpenseMutation = useMutation({
    mutationFn: async (payload: { recipientAddress: string; amountWei: string; memo: string }) => {
      const res = await fetch(`/api/projects/${projectId}/expenses`, {
        method: 'POST',
        headers: devAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to propose expense');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', projectId] });
      setNewExpenseRecipient('');
      setNewExpenseAmountWei('');
      setNewExpenseMemo('');
    },
  });

  const logsList = logsData?.logs ?? [];
  const milestonesList = milestonesData?.milestones ?? [];
  const expensesList = expensesData?.expenses ?? [];

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogTitle || !newLogContent) return;
    createLogMutation.mutate({ title: newLogTitle, content: newLogContent });
  };

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle || !newMilestoneDescUri) return;
    createMilestoneMutation.mutate({
      title: newMilestoneTitle,
      descriptionUri: newMilestoneDescUri,
    });
  };

  const handleProposeExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseRecipient || !newExpenseAmountWei || !newExpenseMemo) return;
    proposeExpenseMutation.mutate({
      recipientAddress: newExpenseRecipient,
      amountWei: newExpenseAmountWei,
      memo: newExpenseMemo,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-xs text-slate-400 hover:text-cyan-400 font-mono">
              ← Projects
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-mono text-cyan-400">{projectId || 'Loading...'}</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Project Workspace</h1>
          <p className="text-xs text-slate-400">
            Network: Base Sepolia • Connected to API Endpoint
          </p>
        </div>

        {/* AI Agent Health Badge */}
        <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-slate-400 uppercase font-mono tracking-wider">
              AI Health Index
            </div>
            <div className="text-lg font-black text-emerald-400 font-mono">88 / 100</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
            ✓
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-px">
        {(
          [
            { key: 'overview', label: 'Overview' },
            { key: 'logs', label: `Research Logs (${logsList.length})` },
            { key: 'treasury', label: `Treasury & Expenses (${expensesList.length})` },
            { key: 'milestones', label: `Milestones (${milestonesList.length})` },
            { key: 'export', label: 'Reports & Export' },
          ] as Array<{ key: WorkspaceTab; label: string }>
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer ${
              activeTab === tab.key
                ? 'bg-slate-900 text-cyan-400 border-t border-x border-slate-800'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">
              Project Overview & AI Agent Diagnostics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-mono">TRACKER AGENT</span>
                <div className="text-xl font-bold text-emerald-400">92 / 100</div>
                <p className="text-xs text-slate-400">
                  High research log frequency & active team updates.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-mono">SPENDING AGENT</span>
                <div className="text-xl font-bold text-cyan-400">85 / 100</div>
                <p className="text-xs text-slate-400">
                  Treasury burn rate risk low. Expenses reconciled.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-mono">MILESTONE AGENT</span>
                <div className="text-xl font-bold text-purple-400">87 / 100</div>
                <p className="text-xs text-slate-400">IPFS proof URIs verified format compliant.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">Research Logs & Findings</h3>

            <form
              onSubmit={handleAddLog}
              className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3"
            >
              <input
                type="text"
                value={newLogTitle}
                onChange={(e) => setNewLogTitle(e.target.value)}
                placeholder="Log Title (e.g., Benchmark dataset results)"
                className="w-full px-3 py-2 bg-slate-900 text-white rounded border border-slate-800 text-sm focus:border-cyan-500 focus:outline-none"
              />
              <textarea
                rows={2}
                value={newLogContent}
                onChange={(e) => setNewLogContent(e.target.value)}
                placeholder="Log entry description and evidence CID..."
                className="w-full px-3 py-2 bg-slate-900 text-white rounded border border-slate-800 text-sm focus:border-cyan-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={createLogMutation.isPending}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded cursor-pointer disabled:opacity-50"
              >
                {createLogMutation.isPending ? 'Submitting...' : '+ Submit Research Log'}
              </button>
            </form>

            <div className="space-y-3">
              {logsList.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-lg bg-slate-950/40 border border-slate-800/60 space-y-1"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>{log.id}</span>
                    <span>{log.created_at ? log.created_at.slice(0, 10) : ''}</span>
                  </div>
                  <h4 className="font-bold text-white">{log.title}</h4>
                  <p className="text-xs text-slate-300">{log.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'treasury' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">Treasury Balance & Expense Ledger</h3>
            <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 uppercase font-mono">
                  On-Chain Grant Treasury
                </span>
                <div className="text-2xl font-bold text-white font-mono">10.00 ETH</div>
              </div>
            </div>

            {(userRole === 'owner' || userRole === 'admin') && (
              <form
                onSubmit={handleProposeExpense}
                className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3"
              >
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Propose New Expense (Owner / Admin Only)
                </h4>
                <input
                  type="text"
                  value={newExpenseRecipient}
                  onChange={(e) => setNewExpenseRecipient(e.target.value)}
                  placeholder="Recipient Wallet Address (0x...)"
                  className="w-full px-3 py-2 bg-slate-900 text-white rounded border border-slate-800 text-sm focus:border-cyan-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={newExpenseAmountWei}
                  onChange={(e) => setNewExpenseAmountWei(e.target.value)}
                  placeholder="Amount in Wei (e.g. 1000000000000000000)"
                  className="w-full px-3 py-2 bg-slate-900 text-white rounded border border-slate-800 text-sm focus:border-cyan-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={newExpenseMemo}
                  onChange={(e) => setNewExpenseMemo(e.target.value)}
                  placeholder="Expense Memo / Purpose"
                  className="w-full px-3 py-2 bg-slate-900 text-white rounded border border-slate-800 text-sm focus:border-cyan-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={proposeExpenseMutation.isPending}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded cursor-pointer disabled:opacity-50"
                >
                  {proposeExpenseMutation.isPending ? 'Proposing...' : '+ Propose Expense'}
                </button>
              </form>
            )}

            {userRole === 'member' && (
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800">
                <p className="text-xs text-slate-400">
                  Only project owners and admins can propose expenses. You have read-only access to
                  the treasury.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Expense Ledger
              </h4>
              {expensesList.map((exp) => (
                <div
                  key={exp.id}
                  className="p-3 rounded bg-slate-950/40 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-white">{exp.memo}</span>
                    <p className="text-slate-400 font-mono">{exp.recipient_address}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-cyan-400">{exp.amount_wei} wei</span>
                    <span className="ml-2 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase text-[10px] font-bold">
                      {exp.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'milestones' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">Milestone Review & Fund Release</h3>

            {(userRole === 'owner' || userRole === 'admin') && (
              <form
                onSubmit={handleAddMilestone}
                className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3"
              >
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Create Milestone (Owner / Admin Only)
                </h4>
                <input
                  type="text"
                  value={newMilestoneTitle}
                  onChange={(e) => setNewMilestoneTitle(e.target.value)}
                  placeholder="Milestone Title"
                  className="w-full px-3 py-2 bg-slate-900 text-white rounded border border-slate-800 text-sm focus:border-cyan-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={newMilestoneDescUri}
                  onChange={(e) => setNewMilestoneDescUri(e.target.value)}
                  placeholder="Description URI (https://...)"
                  className="w-full px-3 py-2 bg-slate-900 text-white rounded border border-slate-800 text-sm focus:border-cyan-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={createMilestoneMutation.isPending}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded cursor-pointer disabled:opacity-50"
                >
                  {createMilestoneMutation.isPending ? 'Creating...' : '+ Create Milestone'}
                </button>
              </form>
            )}

            {userRole === 'member' && (
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800">
                <p className="text-xs text-slate-400">
                  Only project owners and admins can create milestones. You have read-only access to
                  milestones.
                </p>
              </div>
            )}

            {milestonesList.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-lg bg-slate-950/40 border border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white">{m.title}</h4>
                  <span className="px-2.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-xs font-semibold capitalize">
                    {m.state}
                  </span>
                </div>
                {m.proof_uri && (
                  <div className="text-xs font-mono text-slate-400">
                    Proof URI:{' '}
                    <a
                      href={m.proof_uri}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 underline"
                    >
                      {m.proof_uri}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'export' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">Data Export & Reports</h3>
            <p className="text-xs text-slate-400">
              Download complete project metadata, verified research log entries, and on-chain
              treasury ledger histories.
            </p>

            <div className="flex items-center gap-4 pt-2">
              <a
                href={`/api/projects/${projectId}/export?format=csv&section=all`}
                download
                className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-cyan-500/20 cursor-pointer inline-flex items-center gap-2"
              >
                📥 Download CSV Ledger
              </a>
              <a
                href={`/api/projects/${projectId}/export?format=json&section=all`}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 font-semibold text-xs rounded-lg cursor-pointer inline-flex items-center gap-2"
              >
                🔍 View JSON Report
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
