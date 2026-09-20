'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';

interface Invite {
  id: string;
  entity_type: string;
  entity_id: string;
  inviter_id: string;
  token: string;
  status: string;
  message?: string | null;
  created_at?: string | null;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { authenticated, authReady } = useAuth();
  const { getAccessToken } = usePrivy();

  const { data, isLoading } = useQuery<{ received: Invite[]; sent: Invite[] }>({
    queryKey: ['invites'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return { received: [], sent: [] };
      const res = await fetch('/api/invites', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { received: [], sent: [] };
      return res.json();
    },
    enabled: authReady && authenticated,
  });

  const respond = useMutation({
    mutationFn: async ({ token, action }: { token: string; action: 'accept' | 'decline' }) => {
      const token2 = await getAccessToken();
      if (!token2) throw new Error('Not authenticated');
      const res = await fetch(`/api/invites/${token}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token2}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('Failed to respond');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invites'] }),
  });

  if (!authReady || isLoading) {
    return <div className="p-8 text-[13px] text-[#6B6F76]">Loading inbox</div>;
  }
  if (!authenticated) {
    return (
      <div className="p-8 text-center rounded-[8px] border border-[#E4E2DC] bg-white">
        <p className="text-[14px] font-medium text-[#16181D]">Log in to see your inbox</p>
      </div>
    );
  }

  const received = data?.received ?? [];
  const sent = data?.sent ?? [];

  return (
    <div className="max-w-[720px] mx-auto space-y-6">
      <h1 className="text-[20px] font-semibold text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
        Inbox
      </h1>

      <section className="space-y-3">
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-[#6B6F76]">Invites for you ({received.length})</h2>
        {received.length === 0 && <p className="text-[13px] text-[#6B6F76]">No pending invites.</p>}
        {received.map((inv) => (
          <div key={inv.id} className="p-4 rounded-[8px] border border-[#E4E2DC] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[14px] font-medium text-[#16181D]">Invite to collaborate on {inv.entity_type} {inv.entity_id.slice(0, 8)}</p>
              {inv.message && <p className="text-[13px] text-[#6B6F76]">{inv.message}</p>}
              <p className="text-[12px] text-[#6B6F76]">{inv.created_at ? inv.created_at.slice(0, 10) : ''}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => respond.mutate({ token: inv.token, action: 'accept' })}
                disabled={respond.isPending}
                className="px-4 py-1.5 rounded-[6px] bg-[#1B2A4A] text-white text-[13px] hover:bg-[#263A5E] disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => respond.mutate({ token: inv.token, action: 'decline' })}
                disabled={respond.isPending}
                className="px-4 py-1.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-[#FAFAF8] disabled:opacity-50"
              >
                Decline
              </button>
              {inv.entity_type === 'project' && (
                <Link href={`/projects/${inv.entity_id}`} className="px-4 py-1.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-[#FAFAF8]">
                  View
                </Link>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-[#6B6F76]">Sent by you ({sent.length})</h2>
        {sent.length === 0 && <p className="text-[13px] text-[#6B6F76]">Nothing pending.</p>}
        {sent.map((inv) => (
          <div key={inv.id} className="p-3 rounded-[6px] border border-[#E4E2DC] bg-[#FAFAF8] text-[13px] text-[#6B6F76]">
            {inv.entity_id.slice(0, 8)} · {inv.status} · token {inv.token.slice(0, 8)}
          </div>
        ))}
      </section>
    </div>
  );
}
