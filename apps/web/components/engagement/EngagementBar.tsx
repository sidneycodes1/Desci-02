'use client';

import { LikeButton } from './LikeButton';
import { CommentSection } from './CommentSection';

interface Props {
  targetType: 'project' | 'article';
  targetId: string;
  targetSlug?: string; // for article share URL
  onFundClick: () => void;
}

// No isOwner/role check in any of the four — Like/Comment/Share/Fund are open to any authenticated viewer who can see parent.
export function EngagementBar({ targetType, targetId, targetSlug, onFundClick }: Props) {
  const handleShare = async () => {
    const url =
      targetType === 'article' && targetSlug
        ? `${window.location.origin}/a/${targetSlug}`
        : `${window.location.origin}/projects/${targetId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy link:', url);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <LikeButton targetType={targetType} targetId={targetId} />
        <button
          onClick={handleShare}
          className="px-3 py-1.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-[#FAFAF8]"
        >
          Share
        </button>
        <button
          onClick={onFundClick}
          className="px-3 py-1.5 rounded-[6px] border border-[#E4E2DC] bg-white text-[13px] text-[#16181D] hover:bg-[#FAFAF8]"
        >
          Fund
        </button>
      </div>
      <CommentSection targetType={targetType} targetId={targetId} />
    </div>
  );
}
