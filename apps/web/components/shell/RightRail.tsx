'use client';

import React from 'react';

export interface RightRailContext {
  treasuryEth?: string;
  committedEth?: string;
  milestonesDone?: number;
  milestonesTotal?: number;
  funders?: number;
}

export function RightRail({ ctx }: { ctx?: RightRailContext }) {
  const [open, setOpen] = React.useState(false);

  // Collapsed by default — never competes with center column
  if (!open) {
    return (
      <aside className="hidden lg:flex w-10 shrink-0 justify-center sticky top-20 h-fit">
        <button
          onClick={() => setOpen(true)}
          className="px-2 py-2 rounded-[6px] border border-[#E4E2DC] bg-white text-[12px] text-[#6B6F76] hover:text-[#16181D]"
          aria-label="Show details"
        >
          Details
        </button>
      </aside>
    );
  }

  return (
    <aside className="hidden lg:flex w-[280px] shrink-0 flex-col gap-4 p-4 rounded-[8px] border border-[#E4E2DC] bg-white h-fit sticky top-20">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-[#6B6F76]">Details</p>
        <button onClick={() => setOpen(false)} className="text-[12px] text-[#6B6F76] hover:text-[#16181D]">
          Hide
        </button>
      </div>

      <div className="p-3 rounded-[6px] border border-[#E4E2DC] bg-[#FAFAF8] space-y-1">
        <p className="text-[13px] font-medium text-[#16181D]">Funding</p>
        {ctx?.treasuryEth ? (
          <p className="text-[12px] text-[#6B6F76]">
            Treasury {ctx.treasuryEth} · Committed {ctx.committedEth ?? '—'}
          </p>
        ) : (
          <p className="text-[12px] text-[#6B6F76]">Funding and sharing are on each project card.</p>
        )}
        {typeof ctx?.milestonesDone === 'number' && (
          <p className="text-[12px] text-[#6B6F76]">
            Milestones {ctx.milestonesDone}/{ctx.milestonesTotal ?? '?'} · {ctx.funders ?? 0} funders
          </p>
        )}
      </div>
    </aside>
  );
}
