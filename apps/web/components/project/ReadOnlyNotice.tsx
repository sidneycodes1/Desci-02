'use client';

import React from 'react';

export function ReadOnlyNotice({ onAsk }: { onAsk?: () => void }) {
  return (
    <div className="p-3 rounded-[6px] border border-[#E4E2DC] bg-[#FAFAF8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p className="text-[13px] text-[#6B6F76]">
        <span className="font-medium text-[#16181D]">You are reading.</span> Only the owner and invited collaborators can edit.
      </p>
      <button onClick={onAsk} className="px-4 py-1.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-white">
        Ask to collaborate
      </button>
    </div>
  );
}
