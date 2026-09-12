'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ProjectRecord {
  id: string;
  name: string;
  metadata_uri?: string;
  status: string;
  owner_user_id: string;
  created_at: string;
}

export default function HomePage() {
  const queryClient = useQueryClient();
  const [filterState, setFilterState] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Fetch real projects from API endpoint
  const { data: projectsData, isLoading, isError } = useQuery<{ projects: ProjectRecord[] }>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects', {
        headers: {
          Authorization: `Bearer mock_session_token_dev`,
        },
      });
      if (!res.ok) {
        throw new Error('Failed to fetch projects');
      }
      return res.json();
    },
    retry: 1,
  });

  // Real POST mutation to API endpoint
  const createProjectMutation = useMutation({
    mutationFn: async (payload: { name: string; metadataUri: string }) => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer mock_session_token_dev`,
        },
        body: JSON.stringify({
          name: payload.name,
          metadataUri: payload.metadataUri,
          status: 'draft',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create project');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsModalOpen(false);
      setNewTitle('');
      setNewDescription('');
    },
  });

  const projectsList = projectsData?.projects ?? [
    {
      id: 'p-alpha-01',
      name: 'Quantum Decentralized Storage Verification',
      metadata_uri: 'https://ipfs.io/ipfs/QmDescription',
      status: 'active',
      owner_user_id: '0x1234...5678',
      created_at: new Date().toISOString(),
    },
  ];

  const filteredProjects = projectsList.filter((p) => {
    if (filterState === 'all') return true;
    return p.status === filterState;
  });

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;

    createProjectMutation.mutate({
      name: newTitle,
      metadataUri: `https://ipfs.io/ipfs/Qm${encodeURIComponent(newDescription.slice(0, 20))}`,
    });
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-slate-800/80 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono">
            <span>✨ Autonomous DeSci Protocol</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight sm:text-5xl">
            Decentralized Research <span className="text-gradient">Governance</span> & Treasury
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            Manage verifiable milestone payouts, AI-driven project risk analytics, and immutable research logs on Base.
          </p>
          <div className="pt-2 flex items-center gap-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
            >
              + Create Research Project
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Section Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Active Projects</h2>
          <p className="text-xs text-slate-400">Explore decentralized research initiatives and milestones</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
          {['all', 'active', 'draft', 'completed'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterState(st)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors cursor-pointer ${
                filterState === st ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="p-8 text-center text-slate-400 font-mono text-xs">
          Loading projects from database API...
        </div>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((p) => (
          <div
            key={p.id}
            className="group relative p-6 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/40 transition-all duration-300 shadow-xl flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500">{p.id}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                    p.status === 'active'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : p.status === 'draft' || p.status === 'created'
                      ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {p.status}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-1">
                {p.name}
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">
                {p.metadata_uri || 'No description provided.'}
              </p>
            </div>

            <div className="pt-6 mt-4 border-t border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                <span>Owner: {p.owner_user_id ? p.owner_user_id.slice(0, 10) : 'System'}</span>
              </div>
              <Link
                href={`/projects/${p.id}`}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 group-hover:translate-x-1 transition-transform"
              >
                Workspace →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Create Research Project</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Synthetic Biology Gene Circuit Validation"
                  className="w-full px-3.5 py-2 bg-slate-950 text-white rounded-lg border border-slate-800 focus:border-cyan-500 focus:outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Description URI</label>
                <textarea
                  required
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Detailed research objective, methodology, and milestone targets..."
                  className="w-full px-3.5 py-2 bg-slate-950 text-white rounded-lg border border-slate-800 focus:border-cyan-500 focus:outline-none text-sm"
                />
              </div>

              {createProjectMutation.isError && (
                <div className="text-xs text-rose-400">
                  Error creating project: {(createProjectMutation.error as Error).message}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProjectMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                >
                  {createProjectMutation.isPending ? 'Saving...' : 'Save & Launch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
