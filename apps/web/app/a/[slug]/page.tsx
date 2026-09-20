'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';
import { readingMinutes } from '../../../lib/validation/article';
import { EngagementBar } from '../../../components/engagement/EngagementBar';
import { FundModal } from '../../../components/project/FundModal';

interface Article {
  id: string;
  author_id: string;
  project_id?: string | null;
  slug: string;
  title: string;
  subtitle?: string | null;
  body: string;
  status: string;
  published_at?: string | null;
}

export default function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const queryClient = useQueryClient();
  const { authenticated, authReady } = useAuth();
  const { getAccessToken } = usePrivy();
  const [slug, setSlug] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [editBody, setEditBody] = React.useState('');
  const [fundOpen, setFundOpen] = React.useState(false);

  React.useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  const { data, isLoading } = useQuery<{ article: Article | null; canEdit: boolean }>({
    queryKey: ['article', slug],
    queryFn: async () => {
      if (!slug) return { article: null, canEdit: false };
      const token = await getAccessToken();
      if (!token) return { article: null, canEdit: false };
      const res = await fetch(`/api/articles/${slug}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { article: null, canEdit: false };
      return res.json();
    },
    enabled: !!slug && authReady && authenticated,
  });

  const article = data?.article ?? null;

  React.useEffect(() => {
    if (article) setEditBody(article.body);
  }, [article]);

  const save = useMutation({
    mutationFn: async (body: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`/api/articles/${slug}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error('Save failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', slug] });
      setEditing(false);
    },
  });

  if (isLoading) return <div className="p-8 text-[13px] text-[#6B6F76]">Loading article</div>;
  if (!article) {
    return (
      <div className="p-8 text-center rounded-[8px] border border-[#E4E2DC] bg-white">
        <p className="text-[14px] font-medium text-[#16181D]">Article not found</p>
        <Link href="/" className="text-[13px] text-[#1B2A4A] underline">
          Back to feed
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[720px] mx-auto space-y-6">
      <Link href="/" className="text-[13px] text-[#6B6F76] hover:text-[#1B2A4A]">
        Feed
      </Link>
      <div className="space-y-2">
        <span className="px-2 py-0.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[11px] uppercase tracking-wide text-[#6B6F76]">
          Article · {article.status.toUpperCase()}
        </span>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
          {article.title}
        </h1>
        {article.subtitle && <p className="text-[15px] text-[#6B6F76]">{article.subtitle}</p>}
        <p className="text-[12px] text-[#6B6F76]">
          {readingMinutes(article.body)} min read
          {article.published_at ? ` · ${article.published_at.slice(0, 10)}` : ' · draft'}
        </p>
      </div>

      {editing ? (
        <div className="space-y-3">
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={16}
            className="w-full px-3 py-3 rounded-[6px] border border-[#E4E2DC] bg-white text-[14px] text-[#16181D] focus:border-[#1B2A4A] focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => save.mutate(editBody)}
              disabled={save.isPending}
              className="px-4 py-2 rounded-[6px] bg-[#1B2A4A] text-white text-[13px] hover:bg-[#263A5E] disabled:opacity-50"
            >
              {save.isPending ? 'Saving' : 'Save'}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setEditBody(article.body);
              }}
              className="px-4 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-[#FAFAF8]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <article className="prose max-w-none text-[15px] leading-relaxed text-[#16181D] whitespace-pre-wrap border-t border-[#E4E2DC] pt-4">
          {article.body}
        </article>
      )}

      <EngagementBar
        targetType="article"
        targetId={article.id}
        targetSlug={article.slug}
        onFundClick={() => {
          if (article.project_id) setFundOpen(true);
        }}
      />

      <div className="flex flex-wrap items-center gap-2 pt-2">
        {article.project_id && (
          <Link
            href={`/projects/${article.project_id}`}
            className="text-[13px] text-[#1B2A4A] hover:underline"
          >
            View linked project
          </Link>
        )}
        {data?.canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 rounded-[6px] bg-[#1B2A4A] text-white text-[13px] hover:bg-[#263A5E]"
          >
            Edit
          </button>
        )}
      </div>

      {!data?.canEdit && (
        <p className="text-[13px] text-[#6B6F76] p-3 rounded-[6px] border border-[#E4E2DC] bg-[#FAFAF8]">
          You are reading. Only the author and invited collaborators can edit.
        </p>
      )}

      {fundOpen && article.project_id && (
        <FundModal
          projectId={article.project_id}
          projectName={article.title}
          onClose={() => setFundOpen(false)}
          onFunded={() => setFundOpen(false)}
        />
      )}
    </div>
  );
}
