'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Feed' },
  { href: '/notifications', label: 'Notifications' },
];

export function LeftSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-[240px] shrink-0 flex-col gap-8 p-4 rounded-[8px] border border-[#E4E2DC] bg-white h-fit sticky top-20">
      <nav className="space-y-1">
        <p className="px-2 text-[11px] uppercase tracking-wide text-[#6B6F76]">Navigation</p>
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`block px-3 py-2 rounded-[6px] text-[14px] ${
                active
                  ? 'bg-[#1B2A4A] text-white'
                  : 'text-[#16181D] hover:bg-[#FAFAF8]'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/settings"
          className={`block px-3 py-2 rounded-[6px] text-[14px] ${pathname === '/settings' ? 'bg-[#1B2A4A] text-white' : 'text-[#16181D] hover:bg-[#FAFAF8]'}`}
        >
          Profile
        </Link>
      </nav>

      <div className="pt-4 border-t border-[#E4E2DC]">
        <Link
          href="/#create"
          className="block w-full text-center px-3 py-2 rounded-[6px] text-[14px] font-medium bg-[#1B2A4A] text-white hover:bg-[#263A5E]"
        >
          New Project
        </Link>
        <p className="px-2 mt-2 text-[12px] leading-relaxed text-[#6B6F76]">
          Any wallet creates. You become owner.
        </p>
      </div>
    </aside>
  );
}
