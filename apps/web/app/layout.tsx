import './globals.css';
import React from 'react';
import Providers from './providers';
import { Navbar } from '../components/Navbar';

export const metadata = {
  title: 'SciAgent Protocol — Decentralized Science Workspace',
  description: 'AI-assisted research governance, milestone verification, and grant treasury protocol.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-cyan-500 selection:text-white">
        <Providers>
          <Navbar />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
