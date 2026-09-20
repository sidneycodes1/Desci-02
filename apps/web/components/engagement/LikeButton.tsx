'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../app/auth/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';

interface Props {
  targetType: 'project' | 'article';
  targetId: string;
}

// No isOwner/role check — any authenticated wallet can like any visible target.
export function LikeButton({ targetType, targetId }: Props) {
  const { authenticated, authReady } = useAuth();
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();

  const { data } = useQuery<{ count: number; liked: boolean }>({
    queryKey: ['likes', targetType, targetId],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return { count: 0, liked: false };
      const res = await fetch(`/api/likes?targetType=${targetType}&targetId=${targetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { count: 0, liked: false };
      return res.json();
    },
    enabled: authReady && authenticated && !!targetId,
  });

  const count = data?.count ?? 0;
  const liked = data?.liked ?? false;

  const toggle = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId }),
      });
      if (!res.ok) throw new Error('Like failed');
      return res.json() as Promise<{ liked: boolean; count: number }>;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['likes', targetType, targetId] });
      const prev = queryClient.getQueryData<{ count: number; liked: boolean }>(['likes', targetType, targetId]);
      queryClient.setQueryData(['likes', targetType, targetId], {
        count: liked ? Math.max(0, count - 1) : count + 1,
        liked: !liked,
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['likes', targetType, targetId], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['likes', targetType, targetId] });
    },
  });

  return (
    <button
      onClick={() => {
        if (!authenticated) return;
        toggle.mutate();
      }}
      disabled={!authenticated || !authReady}
      className={`px-3 py-1.5 rounded-[6px] border text-[13px] ${
        liked
          ? 'border-[#1B2A4A] bg-[#1B2A4A] text-white'
          : 'border-[#E4E2DC] bg-white text-[#6B6F76] hover:text-[#16181D] hover:border-[#1B2A4A]'
      }`}
      aria-pressed={liked}
      title={authenticated ? (liked ? 'Unlike' : 'Like') : 'Log in to like'}
    >
      Like{count > 0 ? ` ${count}` : ''}
    </button>
  );
}
