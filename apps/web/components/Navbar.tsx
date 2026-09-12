'use client';

import React from 'react';
import Link from 'next/link';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            S
          </div>
          <div>
            <span className="text-lg font-bold text-white tracking-tight">SciAgent</span>
            <span className="text-xs text-cyan-400 font-mono ml-2 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
              Protocol v0.1
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-6">
          <Link href="/" className="text-sm font-medium text-slate-300 hover:text-cyan-400 transition-colors">
            Projects
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Docs
          </a>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Base Sepolia
          </div>
        </nav>
      </div>
    </header>
  );
}
