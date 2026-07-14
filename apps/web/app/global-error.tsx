'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-black text-white">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="max-w-md text-center text-sm text-white/70">
            The application hit an unrecoverable error. You can retry the route or reload the page.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
