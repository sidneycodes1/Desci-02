'use client';

import { notFound, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface UserProfile {
  id: string;
  handle: string;
  displayName: string;
  bio: string | null;
}

interface ArticlePreview {
  id: string;
  title: string;
  subtitle: string | null;
  body: string;
}

export default function UserProfilePage() {
  const pathname = usePathname();
  const handle = pathname.split('/')[2]; // extract handle from /u/[handle]

  const [user, setUser] = useState<UserProfile | null>(null);
  const [articles, setArticles] = useState<ArticlePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) return;

    async function fetchProfile() {
      try {
        // Fetch user articles via API
        const res = await fetch(`/api/articles?authorHandle=${encodeURIComponent(handle)}`, {
          credentials: 'include',
        });

        if (!res.ok) {
          const errData = await res.json();
          setError(errData.error || 'Failed to load profile');
          setLoading(false);
          return;
        }

        const data = await res.json();
        setUser({
          id: data.user?.id || handle,
          handle,
          displayName: data.user?.displayName || handle,
          bio: data.user?.bio,
        });
        setArticles(data.articles || []);
      } catch (err) {
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [handle]);

  if (loading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center p-8">
        <span className="text-[#6B6F76]">Loading profile…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#8A5A5A]">{error}</p>
        <Link href="/" className="mt-4 text-[#1B2A4A] hover:underline" rel="noopener">
          Return to feed
        </Link>
      </div>
    );
  }

  if (!user) {
    notFound();
  }

  // Calculate total reading time (approx 200 words per minute)
  const totalReadingTime = articles.length > 0
    ? Math.max(
        1,
        articles.reduce(
          (sum, a) => {
            const wordCount = a.body.split(/\s+/).length;
            return sum + Math.ceil(wordCount / 200);
          },
          0
        )
      )
    : 0;

  return (
    <div className="max-w-[720px] mx-auto p-6 border border-[#E4E2DC] bg-white rounded-[8px]">
      <div className="flex flex-col items-start gap-4 pb-4 border-b border-[#E4E2DC]/60">
        <div>
          <h1 className="text-2xl font-bold text-[#16181D]">
            {user.displayName || user.handle}
          </h1>
          <p className="text-[#6B6F76] text-sm">{user.handle}</p>
          {user.bio && (
            <p className="mt-2 text-[#6B6F76] text-sm">{user.bio}</p>
          )}
        </div>
      </div>

      {articles.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-2 text-[#6B6F76] text-xs">
            <div>Articles</div>
            <div>{articles.length}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[#6B6F76] text-xs">
            <div>Reading time</div>
            <div>{totalReadingTime} min</div>
          </div>
        </div>
      )}

      {articles.length === 0 && (
        <p className="mt-6 text-[#6B6F76] text-sm text-center">
          No published articles yet. <Link
          href="/"
          className="text-[#1B2A4A] hover:underline"
        >
          Return to feed
        </Link>.
        </p>
      )}
    </div>
  );
}