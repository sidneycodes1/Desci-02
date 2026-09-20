'use client';

import React from 'react';

const ITEMS = [
  'Invite collaborator',
  'Manage collaborators',
  'Link to project',
  'Attach milestone',
  'Add evidence (IPFS)',
  'Visibility — Public / Draft',
  'Add tags',
  'Save draft',
  'Preview as reader',
  'Duplicate',
  'Delete draft',
];

export function EditorDotsMenu({ onInvite }: { onInvite: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        className="px-3 py-1.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-[#FAFAF8]"
      >
        More
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-[8px] border border-[#E4E2DC] bg-white p-2 z-50 modal-shadow">
          {ITEMS.map((label) => (
            <button
              key={label}
              onClick={() => {
                setOpen(false);
                if (label === 'Invite collaborator') onInvite();
              }}
              className="block w-full text-left px-3 py-1.5 rounded-[6px] text-[13px] text-[#16181D] hover:bg-[#FAFAF8]"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
