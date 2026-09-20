'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';
import {
  buildExportUrl,
  formatWeiToEth,
  sumCommittedExpensesWei,
  type ExportSection,
} from '../../../lib/workspace';
import { canEditProject, canInvite } from '../../../lib/membership';
import { ReadOnlyNotice } from '../../../components/project/ReadOnlyNotice';
import { InviteModal } from '../../../components/editor/InviteModal';
import { EditorDotsMenu } from '../../../components/editor/EditorDotsMenu';
import { FundModal } from '../../../components/project/FundModal';
import { EngagementBar } from '../../../components/engagement/EngagementBar';

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
type Role = 'admin' | 'owner' | 'member' | 'viewer';

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="p-4 rounded-[8px] border border-[#E4E2DC] bg-white space-y-1">
      <span className="text-[11px] uppercase tracking-wide text-[#6B6F76]">{label}</span>
      <div className="text-[18px] font-semibold text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
        {value}
      </div>
      <p className="text-[12px] text-[#6B6F76]">{sub}</p>
    </div>
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-[16px] font-semibold text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
        {children}
      </h3>
      {hint && <p className="text-[13px] text-[#6B6F76]">{hint}</p>}
    </div>
  );
}

export default function ProjectWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const queryClient = useQueryClient();
  const { authenticated, authReady } = useAuth();
  const { getAccessToken } = usePrivy();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [projectId, setProjectId] = useState<string>('');
  const [userRole, setUserRole] = useState<Role>('viewer');

  React.useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  const { data: projectData } = useQuery<{
    project: ProjectRecord | null;
    userRole: Role;
  }>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return { project: null, userRole: 'viewer' as const };
      const token = await getAccessToken();
      if (!token) return { project: null, userRole: 'viewer' as const };
      const res = await fetch(`/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { project: null, userRole: 'viewer' as const };
      return res.json();
    },
    enabled: !!projectId && authReady && authenticated,
  });

  React.useEffect(() => {
    if (projectData?.userRole) setUserRole(projectData.userRole);
  }, [projectData]);

  const project = projectData?.project ?? null;
  const canWrite = userRole === 'owner' || userRole === 'admin';

  const [newLogTitle, setNewLogTitle] = useState('');
  const [newLogContent, setNewLogContent] = useState('');
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDescUri, setNewMilestoneDescUri] = useState('');
  const [newExpenseRecipient, setNewExpenseRecipient] = useState('');
  const [newExpenseAmountWei, setNewExpenseAmountWei] = useState('');
  const [newExpenseMemo, setNewExpenseMemo] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [askSent, setAskSent] = useState(false);

  const [exportSection, setExportSection] = useState<ExportSection>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [jsonPreview, setJsonPreview] = useState<Record<string, unknown> | null>(null);
  const [csvPreview, setCsvPreview] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const { data: logsData } = useQuery<{ logs: ResearchLogRecord[] }>({
    queryKey: ['logs', projectId],
    queryFn: async () => {
      if (!projectId) return { logs: [] };
      const token = await getAccessToken();
      if (!token) return { logs: [] };
      const res = await fetch(`/api/projects/${projectId}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { logs: [] };
      return res.json();
    },
    enabled: !!projectId && authReady && authenticated,
  });

  const { data: milestonesData } = useQuery<{ milestones: MilestoneRecord[] }>({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      if (!projectId) return { milestones: [] };
      const token = await getAccessToken();
      if (!token) return { milestones: [] };
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { milestones: [] };
      return res.json();
    },
    enabled: !!projectId && authReady && authenticated,
  });

  const { data: expensesData } = useQuery<{ expenses: ExpenseRecord[] }>({
    queryKey: ['expenses', projectId],
    queryFn: async () => {
      if (!projectId) return { expenses: [] };
      const token = await getAccessToken();
      if (!token) return { expenses: [] };
      const res = await fetch(`/api/projects/${projectId}/expenses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { expenses: [] };
      return res.json();
    },
    enabled: !!projectId && authReady && authenticated,
  });

  const { data: treasuryData, isLoading: isTreasuryLoading } = useQuery<{
    balance: { onchain_balance_wei?: string; onchainBalanceWei?: string };
  }>({
    queryKey: ['treasury', projectId],
    queryFn: async () => {
      if (!projectId) return { balance: {} };
      const token = await getAccessToken();
      if (!token) return { balance: {} };
      const res = await fetch(`/api/projects/${projectId}/treasury`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { balance: {} };
      return res.json();
    },
    enabled: !!projectId && authReady && authenticated,
  });

  const createLogMutation = useMutation({
    mutationFn: async (payload: { title: string; content: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`/api/projects/${projectId}/logs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`/api/projects/${projectId}/expenses`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Failed to propose expense');
      }
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
  const balanceWei =
    treasuryData?.balance?.onchain_balance_wei ?? treasuryData?.balance?.onchainBalanceWei ?? null;
  const committedWei = sumCommittedExpensesWei(
    expensesList.map((e) => ({ amountWei: e.amount_wei, status: e.status }))
  );
  const proposedCount = expensesList.filter((e) => e.status === 'proposed').length;

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

  const handleExport = async (format: 'csv' | 'json') => {
    if (!projectId || isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(buildExportUrl(projectId, format, exportSection), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export request failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (format === 'json') {
        window.open(url, '_blank', 'noreferrer');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `project-${projectId}-${exportSection}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setExportError('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreview = async () => {
    if (!projectId || isPreviewLoading) return;
    setIsPreviewLoading(true);
    setExportError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const authH = { Authorization: `Bearer ${token}` };
      const [jsonRes, csvRes] = await Promise.all([
        fetch(buildExportUrl(projectId, 'json', exportSection), { headers: authH }),
        fetch(buildExportUrl(projectId, 'csv', exportSection), { headers: authH }),
      ]);
      if (!jsonRes.ok || !csvRes.ok) throw new Error('Preview failed');
      const json = await jsonRes.json();
      setJsonPreview(json.report as Record<string, unknown>);
      setCsvPreview(await csvRes.text());
    } catch {
      setExportError('Preview failed. Please try again.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const tabs: Array<{ key: WorkspaceTab; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'logs', label: `Logs (${logsList.length})` },
    { key: 'treasury', label: `Treasury` },
    { key: 'milestones', label: `Milestones (${milestonesList.length})` },
    { key: 'export', label: 'Reports' },
  ];

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E4E2DC] space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#6B6F76]">
          <Link href="/" className="hover:text-[#1B2A4A]">Feed</Link>
          <span>/</span>
          <span className="truncate max-w-[320px] text-[#16181D]" title={projectId}>
            {projectId || 'Loading'}
          </span>
          <span className="px-2 py-0.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[11px] uppercase tracking-wide text-[#6B6F76]">
            {userRole}
          </span>
          {project && (
            <span className="px-2 py-0.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[11px] uppercase tracking-wide text-[#6B6F76]">
              {project.status}
            </span>
          )}
        </div>
        <h1 className="text-[24px] font-semibold tracking-tight text-[#16181D] truncate" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
          {project?.name ?? 'Project'}
        </h1>
        <p className="text-[13px] text-[#6B6F76] truncate">{project?.metadata_uri ?? 'Base Sepolia · Research project'}</p>
        <EngagementBar targetType="project" targetId={projectId} onFundClick={() => setFundOpen(true)} />
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {project &&
            canInvite({
              ownerUserId: project.owner_user_id,
              appUserId: '',
              isCollaborator: userRole === 'member',
              isAdmin: userRole === 'admin',
            }) && (
              <button onClick={() => setInviteOpen(true)} className="px-3 py-1.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-[#FAFAF8]">
                Invite
              </button>
            )}
          <EditorDotsMenu onInvite={() => setInviteOpen(true)} />
          <Link href={`/edit/${projectId}`} className="px-3 py-1.5 rounded-[6px] bg-[#1B2A4A] text-white text-[13px] hover:bg-[#263A5E]">
            Open editor
          </Link>
        </div>
        {project &&
          !canEditProject({
            ownerUserId: project.owner_user_id,
            appUserId: '',
            isCollaborator: userRole === 'member',
            isAdmin: userRole === 'admin',
          }) &&
          userRole !== 'owner' && (
            <div className="pt-3">
              <ReadOnlyNotice onAsk={() => setAskSent(true)} />
              {askSent && <p className="text-[12px] text-[#5A7A5A] pt-2">Request sent to owner.</p>}
            </div>
          )}
      </div>

      <div className="flex items-center justify-between p-3 rounded-[8px] border border-[#E4E2DC] bg-white">
        <div className="text-[13px] text-[#6B6F76]">
          Committed <span className="font-medium text-[#16181D]">{formatWeiToEth(committedWei)}</span> · {expensesList.length} expenses · {proposedCount} proposed
        </div>
        <button onClick={() => setActiveTab('export')} className="px-3 py-1.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-[#FAFAF8]">
          Export
        </button>
      </div>

      <div className="flex items-center gap-1 border-b border-[#E4E2DC] overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-[#1B2A4A] text-[#1B2A4A]'
                : 'border-transparent text-[#6B6F76] hover:text-[#16181D]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 rounded-[8px] border border-[#E4E2DC] bg-white">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <SectionTitle>Project Overview</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard label="On-chain balance" value={isTreasuryLoading ? '—' : formatWeiToEth(balanceWei)} sub="Treasury cache" />
              <StatCard label="Committed spend" value={formatWeiToEth(committedWei)} sub="Approved and executed only" />
              <StatCard label="Research logs" value={String(logsList.length)} sub="Immutable findings" />
              <StatCard label="Milestones" value={String(milestonesList.length)} sub="Review and fund release" />
            </div>
            {!canWrite && (
              <p className="text-[13px] text-[#6B6F76] border border-[#E4E2DC] rounded-[6px] p-3 bg-[#FAFAF8]">
                You are viewing as {userRole}. Only owners can add logs, milestones, or expenses on this project.
              </p>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4">
            <SectionTitle hint="Entries appear in Reports as Research Logs.">Research Logs</SectionTitle>
            {canWrite ? (
              <form onSubmit={handleAddLog} className="p-4 rounded-[8px] border border-[#E4E2DC] bg-[#FAFAF8] space-y-3">
                <input
                  type="text"
                  value={newLogTitle}
                  onChange={(e) => setNewLogTitle(e.target.value)}
                  placeholder="Log title"
                  className="w-full px-3 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[14px] text-[#16181D] placeholder:text-[#6B6F76] focus:border-[#1B2A4A] focus:outline-none"
                />
                <textarea
                  rows={3}
                  value={newLogContent}
                  onChange={(e) => setNewLogContent(e.target.value)}
                  placeholder="Describe findings, include evidence CID if available"
                  className="w-full px-3 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[14px] text-[#16181D] placeholder:text-[#6B6F76] focus:border-[#1B2A4A] focus:outline-none"
                />
                <button type="submit" disabled={createLogMutation.isPending} className="px-4 py-2 rounded-[6px] bg-[#1B2A4A] text-white text-[13px] hover:bg-[#263A5E] disabled:opacity-50">
                  {createLogMutation.isPending ? 'Saving' : 'Add log'}
                </button>
                {createLogMutation.isError && <p className="text-[13px] text-[#8A5A5A]">Failed to add log.</p>}
              </form>
            ) : (
              <p className="text-[13px] text-[#6B6F76] p-3 rounded-[6px] border border-[#E4E2DC] bg-[#FAFAF8]">Read-only for {userRole}. Only owners can add logs.</p>
            )}
            <div className="space-y-3">
              {logsList.length === 0 && <p className="text-[13px] text-[#6B6F76]">No logs yet.</p>}
              {logsList.map((log) => (
                <div key={log.id} className="p-3 rounded-[6px] border border-[#E4E2DC] bg-white space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-[#6B6F76]">
                    <span className="truncate max-w-[240px]" title={log.id}>
                      {log.id.slice(0, 8)}
                    </span>
                    <span>{log.created_at ? log.created_at.slice(0, 10) : ''}</span>
                  </div>
                  <h4 className="text-[14px] font-medium text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
                    {log.title}
                  </h4>
                  <p className="text-[13px] text-[#6B6F76]">{log.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'treasury' && (
          <div className="space-y-4">
            <SectionTitle hint="Proposed expenses are excluded from committed totals.">Treasury</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="On-chain balance" value={isTreasuryLoading ? '—' : formatWeiToEth(balanceWei)} sub="Cached balance" />
              <StatCard label="Committed" value={formatWeiToEth(committedWei)} sub={`${committedWei} wei`} />
              <StatCard label="Proposed" value={String(proposedCount)} sub={`${expensesList.length} total rows`} />
            </div>
            {canWrite ? (
              <form onSubmit={handleProposeExpense} className="p-4 rounded-[8px] border border-[#E4E2DC] bg-[#FAFAF8] space-y-3">
                <h4 className="text-[13px] font-medium text-[#16181D]">Propose expense</h4>
                <input
                  type="text"
                  value={newExpenseRecipient}
                  onChange={(e) => setNewExpenseRecipient(e.target.value)}
                  placeholder="Recipient address 0x..."
                  className="w-full px-3 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] focus:border-[#1B2A4A] focus:outline-none"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newExpenseAmountWei}
                    onChange={(e) => setNewExpenseAmountWei(e.target.value)}
                    placeholder="Amount in wei"
                    className="w-full px-3 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] focus:border-[#1B2A4A] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newExpenseMemo}
                    onChange={(e) => setNewExpenseMemo(e.target.value)}
                    placeholder="Memo"
                    className="w-full px-3 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] focus:border-[#1B2A4A] focus:outline-none"
                  />
                </div>
                <button type="submit" disabled={proposeExpenseMutation.isPending} className="px-4 py-2 rounded-[6px] bg-[#1B2A4A] text-white text-[13px] hover:bg-[#263A5E] disabled:opacity-50">
                  {proposeExpenseMutation.isPending ? 'Proposing' : 'Propose expense'}
                </button>
                {proposeExpenseMutation.isError && <p className="text-[13px] text-[#8A5A5A]">{(proposeExpenseMutation.error as Error).message}</p>}
              </form>
            ) : (
              <p className="text-[13px] text-[#6B6F76] p-3 rounded-[6px] border border-[#E4E2DC] bg-[#FAFAF8]">Read-only for {userRole}. Only owners can propose expenses.</p>
            )}
            <div className="space-y-2">
              <h4 className="text-[13px] font-medium text-[#16181D]">Ledger ({expensesList.length})</h4>
              {expensesList.map((exp) => (
                <div key={exp.id} className="p-3 rounded-[6px] border border-[#E4E2DC] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[13px] font-medium text-[#16181D]">{exp.memo}</span>
                    <p className="text-[12px] text-[#6B6F76] truncate" title={exp.recipient_address}>
                      {exp.recipient_address}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-[13px] text-[#16181D]">{formatWeiToEth(exp.amount_wei)}</div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[11px] uppercase tracking-wide text-[#6B6F76]">
                      {exp.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'milestones' && (
          <div className="space-y-4">
            <SectionTitle>Milestones</SectionTitle>
            {canWrite ? (
              <form onSubmit={handleAddMilestone} className="p-4 rounded-[8px] border border-[#E4E2DC] bg-[#FAFAF8] space-y-3">
                <input
                  type="text"
                  value={newMilestoneTitle}
                  onChange={(e) => setNewMilestoneTitle(e.target.value)}
                  placeholder="Milestone title"
                  className="w-full px-3 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] focus:border-[#1B2A4A] focus:outline-none"
                />
                <input
                  type="text"
                  value={newMilestoneDescUri}
                  onChange={(e) => setNewMilestoneDescUri(e.target.value)}
                  placeholder="Description URL https://..."
                  className="w-full px-3 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] focus:border-[#1B2A4A] focus:outline-none"
                />
                <button type="submit" disabled={createMilestoneMutation.isPending} className="px-4 py-2 rounded-[6px] bg-[#1B2A4A] text-white text-[13px] hover:bg-[#263A5E] disabled:opacity-50">
                  {createMilestoneMutation.isPending ? 'Creating' : 'Create milestone'}
                </button>
              </form>
            ) : (
              <p className="text-[13px] text-[#6B6F76] p-3 rounded-[6px] border border-[#E4E2DC] bg-[#FAFAF8]">Read-only for {userRole}. Only owners can create milestones.</p>
            )}
            {milestonesList.map((m) => (
              <div key={m.id} className="p-3 rounded-[6px] border border-[#E4E2DC] bg-white space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-[14px] font-medium text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
                    {m.title}
                  </h4>
                  <span className="px-2 py-0.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[11px] uppercase tracking-wide text-[#6B6F76]">
                    {m.state}
                  </span>
                </div>
                {m.proof_uri && (
                  <a href={m.proof_uri} target="_blank" rel="noreferrer" className="text-[13px] text-[#1B2A4A] underline">
                    {m.proof_uri}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'export' && (
          <div className="space-y-4">
            <SectionTitle hint="Download the same data the API validates.">Reports</SectionTitle>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-[#6B6F76]">Section:</span>
              {(['all', 'logs', 'expenses', 'milestones'] as ExportSection[]).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setExportSection(s);
                    setJsonPreview(null);
                    setCsvPreview(null);
                  }}
                  className={`px-3 py-1.5 rounded-[6px] border text-[13px] capitalize ${exportSection === s ? 'bg-[#1B2A4A] text-white border-[#1B2A4A]' : 'bg-white text-[#6B6F76] border-[#E4E2DC] hover:text-[#16181D]'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => handleExport('csv')} disabled={isExporting || !projectId} className="px-4 py-2 rounded-[6px] bg-[#1B2A4A] text-white text-[13px] hover:bg-[#263A5E] disabled:opacity-50">
                {isExporting ? 'Preparing' : 'Download CSV'}
              </button>
              <button type="button" onClick={() => handleExport('json')} disabled={isExporting || !projectId} className="px-4 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-[#FAFAF8] disabled:opacity-50">
                View JSON
              </button>
              <button type="button" onClick={handlePreview} disabled={isPreviewLoading || !projectId} className="px-4 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-[#FAFAF8] disabled:opacity-50">
                {isPreviewLoading ? 'Loading' : 'Preview'}
              </button>
            </div>
            {exportError && <p className="text-[13px] text-[#8A5A5A]">{exportError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Logs" value={String(logsList.length)} sub="research logs" />
              <StatCard label="Expenses" value={String(expensesList.length)} sub={`${committedWei} wei committed`} />
              <StatCard label="Milestones" value={String(milestonesList.length)} sub="milestones" />
              <StatCard label="Total" value={committedWei} sub={formatWeiToEth(committedWei)} />
            </div>
            {jsonPreview && (
              <pre className="p-3 rounded-[6px] border border-[#E4E2DC] bg-[#FAFAF8] text-[12px] text-[#16181D] overflow-auto max-h-96 whitespace-pre-wrap">
                {JSON.stringify(jsonPreview, null, 2)}
              </pre>
            )}
            {csvPreview && (
              <pre className="p-3 rounded-[6px] border border-[#E4E2DC] bg-[#FAFAF8] text-[12px] text-[#16181D] overflow-auto max-h-96 whitespace-pre-wrap">
                {csvPreview.split('\n').slice(0, 40).join('\n')}
              </pre>
            )}
          </div>
        )}
      </div>

      {inviteOpen && (
        <InviteModal projectId={projectId} projectName={project?.name ?? 'project'} onClose={() => setInviteOpen(false)} />
      )}
      {fundOpen && (
        <FundModal
          projectId={projectId}
          projectName={project?.name ?? 'project'}
          onClose={() => setFundOpen(false)}
          onFunded={() => {
            queryClient.invalidateQueries({ queryKey: ['treasury', projectId] });
            queryClient.invalidateQueries({ queryKey: ['funders', projectId] });
          }}
        />
      )}
    </div>
  );
}
