'use client';

import React from 'react';
import { formatWeiToEth } from '../../lib/workspace';
import { usePrivy } from '@privy-io/react-auth';

function ethToWei(eth: string): string | null {
  const trimmed = eth.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(trimmed)) return null;
  const [whole, frac = ''] = trimmed.split('.');
  const padded = (frac + '0'.repeat(18)).slice(0, 18);
  try {
    return (BigInt(whole === '' ? '0' : whole) * 10n ** 18n + BigInt(padded || '0')).toString();
  } catch {
    return null;
  }
}

export function FundModal({
  projectId,
  projectName,
  onClose,
  onFunded,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onFunded: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const [amountEth, setAmountEth] = React.useState('0.1');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const wei = ethToWei(amountEth);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getAccessToken();
    if (!token) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/fund`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountWei: wei }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Funding failed');
      }
      onFunded();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="w-full max-w-md rounded-[8px] border border-[#E4E2DC] bg-white p-6 space-y-4 modal-shadow">
        <div className="flex items-center justify-between pb-3 border-b border-[#E4E2DC]">
          <div>
            <h3 className="text-[16px] font-semibold text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
              Fund project
            </h3>
            <p className="text-[12px] text-[#6B6F76]">{projectName}</p>
          </div>
          <button onClick={onClose} className="text-[#6B6F76] hover:text-[#16181D] px-2" aria-label="Close">
            Close
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#16181D] mb-1">Amount (ETH)</label>
            <input
              value={amountEth}
              onChange={(e) => setAmountEth(e.target.value)}
              inputMode="decimal"
              placeholder="0.1"
              className="w-full px-3 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[14px] text-[#16181D] focus:border-[#1B2A4A] focus:outline-none"
            />
            <p className="mt-1 text-[12px] text-[#6B6F76]">{wei ? `≈ ${wei} wei · ${formatWeiToEth(wei)}` : 'Enter a valid amount (up to 18 decimals)'}</p>
          </div>
          <p className="text-[12px] text-[#6B6F76]">Funding is public and never grants edit access.</p>
          {error && <p className="text-[13px] text-[#8A5A5A]">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-[#FAFAF8]">
              Cancel
            </button>
            <button type="submit" disabled={!wei} className="px-4 py-2 rounded-[6px] bg-[#1B2A4A] text-white text-[13px] hover:bg-[#263A5E] disabled:opacity-50">
              {pending ? 'Funding' : 'Confirm fund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
