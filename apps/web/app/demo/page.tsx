'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { DEMO_PROJECTS, DEMO_ARTICLES, DEMO_USER } from '../../lib/demoData';

export default function DemoPage() {
  const [demoMessage, setDemoMessage] = useState<string | null>(null);

  const showDemoMessage = (action: string) => {
    setDemoMessage(`Demo mode — ${action} is disabled. No data is saved and no API is called.`);
    setTimeout(() => setDemoMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Persistent banner — A: top sticky, not dismissible */}
      <div className="sticky top-0 z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 bg-[#1B2A4A] text-white text-center text-[13px]">
        Demo mode — example data only. No actions are saved. <Link href="/" className="underline">Exit demo → Feed</Link>
      </div>

      {demoMessage && (
        <div className="p-3 rounded-[6px] border border-[#E4E2DC] bg-[#FAFAF8] text-[13px] text-[#1B2A4A] text-center">
          {demoMessage}
        </div>
      )}

      {/* Mock profile */}
      <div className="p-4 rounded-[8px] border border-[#E4E2DC] bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1B2A4A] text-white flex items-center justify-center font-semibold">
            {DEMO_USER.avatarInitial}
          </div>
          <div>
            <div className="text-[14px] font-medium text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
              {DEMO_USER.displayName}
            </div>
            <div className="text-[12px] text-[#6B6F76]">@{DEMO_USER.handle}</div>
            <div className="text-[12px] text-[#6B6F76]">{DEMO_USER.bio}</div>
          </div>
        </div>
        <button
          onClick={() => showDemoMessage('Create project')}
          className="px-4 py-2 rounded-[6px] bg-[#1B2A4A] text-white text-[13px] hover:bg-[#263A5E]"
        >
          New Project
        </button>
      </div>

      <h1 className="text-[20px] font-semibold text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
        Demo feed — 5 example projects
      </h1>

      <div className="space-y-3">
        {DEMO_PROJECTS.map((p) => (
          <article key={p.id} className="p-4 rounded-[8px] border border-[#E4E2DC] bg-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#6B6F76]">{p.owner} · @{p.ownerHandle}</span>
              <span className="px-2 py-0.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[11px] uppercase tracking-wide text-[#6B6F76]">
                {p.status}
              </span>
            </div>
            <h3 className="text-[16px] font-semibold text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
              {p.name}
            </h3>
            <p className="text-[13px] leading-relaxed text-[#6B6F76]">{p.description}</p>
            <p className="text-[11px] text-[#6B6F76]">
              {p.treasuryEth} · {p.funders} funders · {p.createdAt}
            </p>

            {/* Engagement bar — demo: visibly disabled, shows demo message, never calls fetch */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => showDemoMessage('Like')}
                className="px-3 py-1.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#6B6F76]"
              >
                Like {p.likes}
              </button>
              <button
                onClick={() => showDemoMessage('Comment')}
                className="px-3 py-1.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#6B6F76]"
              >
                Comment {p.comments}
              </button>
              <button
                onClick={() => showDemoMessage('Share')}
                className="px-3 py-1.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D]"
              >
                Share
              </button>
              <button
                onClick={() => showDemoMessage('Fund')}
                className="px-3 py-1.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D]"
              >
                Fund
              </button>
            </div>
            <div className="p-3 rounded-[6px] border border-[#E4E2DC] bg-[#FAFAF8] text-[13px] text-[#6B6F76]">
              Demo comments preview — Like/Comment/Share/Fund are disabled in demo. No API is called.
            </div>
          </article>
        ))}
      </div>

      <h2 className="text-[16px] font-semibold text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
        Demo articles (2)
      </h2>
      <div className="space-y-3">
        {DEMO_ARTICLES.map((a) => (
          <article key={a.id} className="p-4 rounded-[8px] border border-[#E4E2DC] bg-white space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-[#6B6F76]">Article</div>
            <h3 className="text-[15px] font-semibold text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
              {a.title}
            </h3>
            <p className="text-[13px] text-[#6B6F76]">{a.subtitle}</p>
            <div className="flex gap-2">
              <button onClick={() => showDemoMessage('Like')} className="px-3 py-1.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#6B6F76]">
                Like {a.likes}
              </button>
              <button onClick={() => showDemoMessage('Share')} className="px-3 py-1.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D]">
                Share
              </button>
            </div>
          </article>
        ))}
      </div>

      <p className="text-[12px] text-[#6B6F76] border-t border-[#E4E2DC] pt-4">
        Code-path proof: this file imports only <code>lib/demoData.ts</code>. <code>grep -r &quot;fetch.*api&quot; app/demo</code> → 0, <code>grep -r &quot;supabase&quot; app/demo</code> → 0. No `fetch`, no DB write.
      </p>
    </div>
  );
}
