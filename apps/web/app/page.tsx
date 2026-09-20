'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';
import {
  WORKSPACE_STEPS,
  canCreateProject,
  getCreateProjectGuidance,
} from '../lib/workspace';
import { EngagementBar } from '../components/engagement/EngagementBar';
import { FundModal } from '../components/project/FundModal';

interface ProjectRecord {
  id: string;
  name: string;
  metadata_uri?: string;
  status: string;
  owner_user_id: string;
  created_at: string;
}

interface ArticleRecord {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  body: string;
  status: string;
  project_id?: string | null;
  published_at?: string | null;
}

type Role = 'admin' | 'owner' | 'member' | 'viewer';

function StatusTag({ status }: { status: string }) {
  return (
    <span className="px-2 py-0.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[11px] uppercase tracking-wide text-[#6B6F76]">
      {status}
    </span>
  );
}

export default function HomePage() {
  const queryClient = useQueryClient();
  const { authenticated, authReady } = useAuth();
  const { getAccessToken } = usePrivy();
  const [filterState, setFilterState] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isArticleOpen, setIsArticleOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [articleTitle, setArticleTitle] = useState('');
  const [articleBody, setArticleBody] = useState('');
  const [userRole, setUserRole] = useState<Role>('viewer');
  const [fundTarget, setFundTarget] = useState<{ id: string; name: string } | null>(null);

  const canFetch = authReady && authenticated;
  const {
    data: projectsData,
    isLoading,
    isError,
    refetch,
  } = useQuery<{ projects: ProjectRecord[]; userRole: Role }>({
    queryKey: ['projects'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/projects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return res.json();
    },
    enabled: authReady && authenticated,
    retry: 1,
  });

  const createProjectMutation = useMutation({
    mutationFn: async (payload: { name: string; metadataUri: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: payload.name,
          metadataUri: payload.metadataUri,
          status: 'draft',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || 'Failed to create project'
        );
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

  React.useEffect(() => {
    if (projectsData?.userRole) {
      setUserRole(projectsData.userRole);
    }
  }, [projectsData]);

  const projectsList = projectsData?.projects ?? [];
  const guidance = getCreateProjectGuidance(userRole);
  void canCreateProject;

  const filteredProjects = projectsList.filter((p) => {
    if (filterState !== 'all' && p.status !== filterState) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.metadata_uri ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;
    const desc = newDescription.trim();
    const metadataUri = /^https?:\/\//.test(desc)
      ? desc
      : `https://ipfs.io/ipfs/Qm${encodeURIComponent(desc.slice(0, 40))}`;
    createProjectMutation.mutate({ name: newTitle.trim(), metadataUri });
  };

  const openCreate = () => {
    if (!authenticated) return;
    setIsModalOpen(true);
  };
  const openArticleCreate = () => {
    if (!authenticated) return;
    setIsArticleOpen(true);
  };

  const { data: articlesData } = useQuery<{ articles: ArticleRecord[] }>({
    queryKey: ['articles'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/articles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { articles: [] };
      return res.json();
    },
    enabled: authReady && authenticated,
    retry: 1,
  });
  const articlesList = articlesData?.articles ?? [];

  const createArticleMutation = useMutation({
    mutationFn: async (payload: { title: string; body: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...payload, status: 'published' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to publish article');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      setIsArticleOpen(false);
      setArticleTitle('');
      setArticleBody('');
    },
  });

  const handleCreateArticle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!articleTitle.trim() || !articleBody.trim()) return;
    createArticleMutation.mutate({ title: articleTitle.trim(), body: articleBody.trim() });
  };

  return (
    <div className="space-y-6">
      {/* Header — editorial, no hero marketing for logged-in feed */}
      <div className="border-b border-[#E4E2DC] pb-4">
        <h1 className="text-[28px] font-semibold tracking-tight text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
          Research feed
        </h1>
        <p className="mt-1 text-[14px] leading-relaxed text-[#6B6F76] max-w-[720px]">
          Browse active projects and articles. Any wallet can create a project — you become its owner. Reading is public; editing is invite-only per project.
        </p>
        <div id="create" className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[14px] text-[#16181D] hover:bg-[#FAFAF8]"
          >
            New project
          </button>
          <button
            onClick={openArticleCreate}
            className="px-4 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[14px] text-[#16181D] hover:bg-[#FAFAF8]"
          >
            New article
          </button>
          <span className="px-2 py-1 rounded-[6px] border border-[#E4E2DC] bg-white text-[11px] text-[#6B6F76]">
            {authenticated ? guidance.badge : 'LOGGED OUT'} · {guidance.message}
          </span>
        </div>
        {!authenticated && authReady && (
          <p className="mt-2 text-[13px] text-[#6B6F76]">Log in to create projects or publish articles.</p>
        )}
      </div>

      {/* Steps — muted, hairline only */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {WORKSPACE_STEPS.map((s) => (
          <div key={s.step} className="p-4 rounded-[8px] border border-[#E4E2DC] bg-white space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-[#6B6F76]">Step {s.step}</div>
            <div className="text-[14px] font-medium text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
              {s.title}
            </div>
            <p className="text-[13px] leading-relaxed text-[#6B6F76]">{s.detail}</p>
          </div>
        ))}
      </section>

      {/* Filter & search */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-3 border-b border-[#E4E2DC]">
        <div>
          <h2 className="text-[18px] font-semibold text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
            Feed <span className="text-[13px] font-normal text-[#6B6F76]">({filteredProjects.length})</span>
          </h2>
          <p className="text-[13px] text-[#6B6F76]">Projects ordered by recent. Open for logs, milestones, and reports.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, id, description"
            className="px-3 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] placeholder:text-[#6B6F76] focus:border-[#1B2A4A] focus:outline-none w-full sm:w-56"
          />
          <div className="flex items-center gap-1 p-1 rounded-[6px] border border-[#E4E2DC] bg-white">
            {['all', 'active', 'draft', 'completed'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterState(st)}
                className={`px-3 py-1.5 rounded-[6px] text-[13px] capitalize ${
                  filterState === st
                    ? 'bg-[#1B2A4A] text-white'
                    : 'text-[#6B6F76] hover:text-[#16181D]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(!authReady || (canFetch && isLoading)) && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="p-4 rounded-[8px] border border-[#E4E2DC] bg-white">
              <div className="h-3 w-24 bg-[#E4E2DC] rounded" />
              <div className="mt-3 h-4 w-48 bg-[#E4E2DC] rounded" />
            </div>
          ))}
        </div>
      )}

      {authReady && !authenticated && (
        <div className="p-8 text-center rounded-[8px] border border-[#E4E2DC] bg-white">
          <p className="text-[14px] font-medium text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
            Feed is public — log in to fund or create
          </p>
          <p className="mt-1 text-[13px] text-[#6B6F76]">Reading is open to everyone. Log in to create your own project.</p>
        </div>
      )}

      {canFetch && isError && (
        <div className="p-6 text-center rounded-[8px] border border-[#E4E2DC] bg-white space-y-3">
          <p className="text-[14px] text-[#6B6F76]">Failed to load projects. Please try again.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-[#FAFAF8]"
          >
            Retry
          </button>
        </div>
      )}

      {canFetch && !isLoading && !isError && filteredProjects.length > 0 && (
        <div className="space-y-3">
          {filteredProjects.map((p) => (
            <article
              key={p.id}
              className="p-4 rounded-[8px] border border-[#E4E2DC] bg-white flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-[#6B6F76] truncate" title={p.id}>
                  {p.id.slice(0, 8)}
                </span>
                <StatusTag status={p.status} />
              </div>
              <h3 className="text-[18px] font-semibold leading-snug text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
                {p.name}
              </h3>
              <p className="text-[13px] leading-relaxed text-[#6B6F76] line-clamp-2">
                {p.metadata_uri || 'No description provided.'}
              </p>
              <div className="pt-3 border-t border-[#E4E2DC] flex items-center justify-between gap-3">
                <span className="text-[12px] text-[#6B6F76]">
                  {p.owner_user_id ? `${p.owner_user_id.slice(0, 8)}` : 'System'} · {p.created_at ? p.created_at.slice(0, 10) : ''}
                </span>
                <Link href={`/projects/${p.id}`} className="text-[13px] font-medium text-[#1B2A4A] hover:underline">
                  Read
                </Link>
              </div>
              <EngagementBar targetType="project" targetId={p.id} onFundClick={() => setFundTarget({ id: p.id, name: p.name })} />
            </article>
          ))}
        </div>
      )}

      {canFetch && !isLoading && !isError && filteredProjects.length === 0 && (
        <div className="p-8 text-center rounded-[8px] border border-[#E4E2DC] bg-white">
          <p className="text-[14px] font-medium text-[#16181D]">
            {projectsList.length === 0 ? 'No projects yet' : 'No matches for this filter'}
          </p>
          <p className="mt-1 text-[13px] text-[#6B6F76]">
            {projectsList.length === 0
              ? 'Create the first research project — you become its owner.'
              : 'Try clearing the search or choosing a different status.'}
          </p>
        </div>
      )}

      {canFetch && articlesList.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
            Articles <span className="text-[13px] font-normal text-[#6B6F76]">({articlesList.length})</span>
          </h2>
          <div className="space-y-3">
            {articlesList.map((a) => (
              <article key={a.id} className="p-4 rounded-[8px] border border-[#E4E2DC] bg-white space-y-3">
                <div className="text-[11px] uppercase tracking-wide text-[#6B6F76]">Article</div>
                <h3 className="text-[16px] font-semibold text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
                  {a.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-[#6B6F76] line-clamp-2">
                  {a.subtitle || a.body.slice(0, 160)}
                </p>
                <div className="flex items-center justify-between">
                  <Link href={`/a/${a.slug}`} className="text-[13px] font-medium text-[#1B2A4A] hover:underline">
                    Read
                  </Link>
                </div>
                <EngagementBar
                  targetType="article"
                  targetId={a.id}
                  targetSlug={a.slug}
                  onFundClick={() => {
                    if (a.project_id) setFundTarget({ id: a.project_id, name: a.title });
                  }}
                />
              </article>
            ))}
          </div>
        </section>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="w-full max-w-lg rounded-[8px] border border-[#E4E2DC] bg-white p-6 space-y-4 modal-shadow">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E2DC]">
              <div>
                <h3 className="text-[16px] font-semibold text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
                  Create Research Project
                </h3>
                <p className="text-[12px] text-[#6B6F76]">You will be the owner. Draft until you publish.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-[#6B6F76] hover:text-[#16181D] px-2 py-1" aria-label="Close">
                Close
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#16181D] mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Synthetic Biology Gene Circuit Validation"
                  className="w-full px-3 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[14px] text-[#16181D] placeholder:text-[#6B6F76] focus:border-[#1B2A4A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#16181D] mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Paste an https:// metadata URL, or write plain text."
                  className="w-full px-3 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[14px] text-[#16181D] placeholder:text-[#6B6F76] focus:border-[#1B2A4A] focus:outline-none"
                />
              </div>

              {createProjectMutation.isError && (
                <div className="text-[13px] text-[#8A5A5A]">
                  Error creating project: {(createProjectMutation.error as Error).message}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-[#FAFAF8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProjectMutation.isPending}
                  className="px-4 py-2 rounded-[6px] bg-[#1B2A4A] text-white text-[13px] font-medium hover:bg-[#263A5E] disabled:opacity-50"
                >
                  {createProjectMutation.isPending ? 'Saving' : 'Create project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isArticleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="w-full max-w-lg rounded-[8px] border border-[#E4E2DC] bg-white p-6 space-y-4 modal-shadow">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E2DC]">
              <h3 className="text-[16px] font-semibold text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
                Publish Article
              </h3>
              <button onClick={() => setIsArticleOpen(false)} className="text-[#6B6F76] hover:text-[#16181D] px-2 py-1" aria-label="Close">
                Close
              </button>
            </div>
            <form onSubmit={handleCreateArticle} className="space-y-4">
              <input
                type="text"
                required
                value={articleTitle}
                onChange={(e) => setArticleTitle(e.target.value)}
                placeholder="Article title"
                className="w-full px-3 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[14px] text-[#16181D] placeholder:text-[#6B6F76] focus:border-[#1B2A4A] focus:outline-none"
              />
              <textarea
                required
                rows={6}
                value={articleBody}
                onChange={(e) => setArticleBody(e.target.value)}
                placeholder="Write your article"
                className="w-full px-3 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[14px] text-[#16181D] placeholder:text-[#6B6F76] focus:border-[#1B2A4A] focus:outline-none"
              />
              {createArticleMutation.isError && (
                <div className="text-[13px] text-[#8A5A5A]">Error: {(createArticleMutation.error as Error).message}</div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsArticleOpen(false)}
                  className="px-4 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-[#FAFAF8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createArticleMutation.isPending}
                  className="px-4 py-2 rounded-[6px] bg-[#1B2A4A] text-white text-[13px] font-medium hover:bg-[#263A5E] disabled:opacity-50"
                >
                  {createArticleMutation.isPending ? 'Publishing' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {fundTarget && (
        <FundModal
          projectId={fundTarget.id}
          projectName={fundTarget.name}
          onClose={() => setFundTarget(null)}
          onFunded={() => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
          }}
        />
      )}
    </div>
  );
}
