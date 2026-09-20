'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../app/auth/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';

interface Props {
  targetType: 'project' | 'article';
  targetId: string;
}

interface CommentRow {
  id: string;
  author_user_id: string;
  body: string;
  created_at: string;
}

// No isOwner/role check — any authenticated wallet who can see parent can comment.
export function CommentSection({ targetType, targetId }: Props) {
  const { authenticated, authReady } = useAuth();
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState('');

  const { data } = useQuery<{ comments: CommentRow[] }>({
    queryKey: ['comments', targetType, targetId],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return { comments: [] };
      const res = await fetch(`/api/comments?targetType=${targetType}&targetId=${targetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { comments: [] };
      return res.json();
    },
    enabled: expanded && authReady && authenticated && !!targetId,
  });

  const create = useMutation({
    mutationFn: async (text: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, body: text }),
      });
      if (!res.ok) throw new Error('Failed to post comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', targetType, targetId] });
      setBody('');
    },
  });

  const comments = data?.comments ?? [];

  return (
    <div className="mt-3 border-t border-[#E4E2DC] pt-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-[13px] text-[#1B2A4A] hover:underline"
      >
        {expanded ? 'Hide comments' : `Comments${comments.length > 0 ? ` (${comments.length})` : ''}`}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {authenticated ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!body.trim()) return;
                create.mutate(body.trim());
              }}
              className="flex gap-2"
            >
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Add a comment"
                maxLength={2000}
                className="flex-1 px-3 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] placeholder:text-[#6B6F76] focus:border-[#1B2A4A] focus:outline-none"
              />
              <button
                type="submit"
                disabled={create.isPending || !body.trim()}
                className="px-4 py-2 rounded-[6px] bg-[#1B2A4A] text-white text-[13px] hover:bg-[#263A5E] disabled:opacity-50"
              >
                Post
              </button>
            </form>
          ) : (
            <p className="text-[13px] text-[#6B6F76]">Log in to comment.</p>
          )}

          {create.isError && <p className="text-[13px] text-[#8A5A5A]">Failed to post comment.</p>}

          <div className="space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="p-3 rounded-[6px] border border-[#E4E2DC] bg-[#FAFAF8]">
                <p className="text-[13px] text-[#16181D] whitespace-pre-wrap">{c.body}</p>
                <p className="mt-1 text-[11px] text-[#6B6F76]">
                  {c.author_user_id.slice(0, 8)} · {c.created_at.slice(0, 16).replace('T', ' ')}
                </p>
              </div>
            ))}
            {comments.length === 0 && <p className="text-[13px] text-[#6B6F76]">No comments yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
