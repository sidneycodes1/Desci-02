'use client';

import React from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';

import { getClientEnv } from '@sciagent/shared/env/client';
import { isPrivyAppIdConfigured } from '@sciagent/shared/privy';

function isPrivyEnabled(): boolean {
  try {
    return isPrivyAppIdConfigured(getClientEnv().NEXT_PUBLIC_PRIVY_APP_ID);
  } catch {
    return false;
  }
}

function LoginButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  if (!ready) {
    return (
      <button
        disabled
        className="px-3 py-1.5 rounded-[6px] border border-[#E4E2DC] text-[13px] text-[#6B6F76] bg-[#FAFAF8]"
      >
        Loading
      </button>
    );
  }

  if (authenticated) {
    const walletAddress = user?.wallet?.address;
    const label = walletAddress
      ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
      : (user?.email?.address ?? 'Account');
    return (
      <div className="flex items-center gap-2">
        <span className="px-3 py-1.5 rounded-[6px] border border-[#E4E2DC] text-[13px] text-[#6B6F76] bg-white">
          {label}
        </span>
        <button
          onClick={() => void logout()}
          className="px-3 py-1.5 rounded-[6px] border border-[#E4E2DC] text-[13px] text-[#16181D] bg-white hover:bg-[#FAFAF8]"
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => void login()}
      className="px-3 py-1.5 rounded-[6px] bg-[#1B2A4A] text-white text-[13px] font-medium hover:bg-[#263A5E]"
    >
      Log in
    </button>
  );
}

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 w-full bg-[#FAFAF8] border-b border-[#E4E2DC]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[6px] bg-[#1B2A4A] flex items-center justify-center text-[#16181D] font-bold text-[14px]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
            S
          </div>
          <span className="text-[16px] font-semibold tracking-tight text-[#16181D]" style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
            SciAgent
          </span>
          <span className="text-[11px] text-[#6B6F76] border border-[#E4E2DC] rounded-[6px] px-2 py-0.5 bg-white">
            v0.1
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          <Link href="/" className="text-[14px] text-[#16181D] hover:text-[#1B2A4A]">
            Feed
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="text-[14px] text-[#6B6F76] hover:text-[#16181D]"
          >
            Docs
          </a>
          <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-[6px] border border-[#E4E2DC] text-[12px] text-[#6B6F76] bg-white">
            <span className="w-2 h-2 rounded-[6px] bg-[#5A7A5A]" />
            Base Sepolia
          </span>
          {isPrivyEnabled() ? <LoginButton /> : null}
        </nav>
      </div>
    </header>
  );
}
