'use client';

import React from 'react';
import { usePrivy } from '@privy-io/react-auth';

export function InviteModal({
  projectId,
  projectName,
  onClose,
  onSent,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onSent?: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const [method, setMethod] = React.useState<'handle' | 'wallet' | 'link'>('handle');
  const [value, setValue] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [linkToken, setLinkToken] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canSend = method !== 'link' || value.trim().length > 0;

  const send = async () => {
    if (!canSend) return;
    const token = await getAccessToken();
    if (!token) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'project',
          entityId: projectId,
          inviteeHandle: method === 'link' ? undefined : value.trim() || undefined,
          message: message.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Failed to send invite');
      }
      const json = await res.json();
      if (method === 'link') setLinkToken(json.invite?.token ?? null);
      else {
        onSent?.();
        onClose();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="w-full max-w-lg rounded-[8px] border border-[#E4E2DC] bg-white p-6 space-y-4 modal-shadow">
        <div className="flex items-center justify-between pb-3 border-b border-[#E4E2DC]">
          <h3 className="text-[16px] font-semibold text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
            Invite to {projectName}
          </h3>
          <button onClick={onClose} className="text-[#6B6F76] hover:text-[#16181D] px-2" aria-label="Close">
            Close
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-wide text-[#6B6F76]">Invite by</p>
          {[
            ['handle', 'Profile handle'],
            ['wallet', 'Wallet address'],
            ['link', 'Shareable invite link'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-[14px] text-[#16181D]">
              <input
                type="radio"
                checked={method === key}
                onChange={() => setMethod(key as 'handle' | 'wallet' | 'link')}
                className="accent-[#1B2A4A]"
              />
              {label}
            </label>
          ))}

          {method !== 'link' && (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={method === 'wallet' ? '0x...' : '@handle'}
              className="w-full px-3 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[14px] text-[#16181D] focus:border-[#1B2A4A] focus:outline-none"
            />
          )}

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-[#6B6F76]">Access level</p>
            <label className="flex items-center gap-2 text-[14px] text-[#16181D]">
              <input type="radio" checked readOnly className="accent-[#1B2A4A]" />
              Collaborator — write logs, edit article, submit proof
            </label>
            <p className="text-[12px] text-[#6B6F76]">Funding never grants edit. Collaborators never control money.</p>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="Message (optional)"
            className="w-full px-3 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[14px] text-[#16181D] focus:border-[#1B2A4A] focus:outline-none"
          />

          {linkToken && (
            <p className="text-[12px] text-[#5A7A5A] break-all">Shareable link created: /api/invites/{linkToken} (accept via Inbox)</p>
          )}

          {error && <p className="text-[13px] text-[#8A5A5A]">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-[#FAFAF8]">
              Cancel
            </button>
            <button onClick={() => void send()} disabled={!canSend || pending} className="px-4 py-2 rounded-[6px] bg-[#1B2A4A] text-white text-[13px] hover:bg-[#263A5E] disabled:opacity-50">
              {pending ? 'Sending' : 'Send invite'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
