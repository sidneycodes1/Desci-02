'use client';

import React from 'react';
import { LeftSidebar } from './LeftSidebar';
import { RightRail, type RightRailContext } from './RightRail';

export function AppShell({
  children,
  rail,
}: {
  children: React.ReactNode;
  rail?: RightRailContext;
}) {
  return (
    <div className="flex items-start gap-6">
      <LeftSidebar />
      <div className="flex-1 min-w-0 max-w-[720px] mx-auto">{children}</div>
      <RightRail ctx={rail} />
    </div>
  );
}
