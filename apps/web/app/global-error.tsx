'use client';
import { useEffect } from 'react';
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="en">
      <body>
        <main style={{ padding: 20 }}>
          <h1>Something went wrong</h1>
          <p>{String(error.message)}</p>
          <button onClick={reset}>Try again</button>
        </main>
      </body>
    </html>
  );
}
