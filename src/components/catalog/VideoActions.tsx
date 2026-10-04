'use client';

import { useState } from 'react';
import { Download, Info, MessageSquare, ThumbsDown, ThumbsUp } from 'lucide-react';
import ShareButton from './ShareButton';

const action = 'inline-flex h-10 items-center gap-2 rounded-md border border-line bg-card px-3 text-[12px] text-white transition-colors hover:border-accent hover:text-accent aria-pressed:border-accent aria-pressed:text-accent';

export default function VideoActions({ description, rating, downloadUrl }: { description: string; rating: number; downloadUrl?: string }) {
  const [tab, setTab] = useState<'about' | 'comments' | null>(null);
  const [vote, setVote] = useState<'like' | 'dislike' | null>(null);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-2 flex items-center overflow-hidden rounded-md border border-line bg-card">
          <button aria-label="Like video" aria-pressed={vote === 'like'} onClick={() => setVote(vote === 'like' ? null : 'like')} className="h-10 px-3 text-white hover:text-accent aria-pressed:text-accent"><ThumbsUp size={16} /></button>
          <span className="border-x border-line px-3 text-[12px]">{rating}%</span>
          <button aria-label="Dislike video" aria-pressed={vote === 'dislike'} onClick={() => setVote(vote === 'dislike' ? null : 'dislike')} className="h-10 px-3 text-white hover:text-accent aria-pressed:text-accent"><ThumbsDown size={16} /></button>
        </div>
        {downloadUrl && <a href={downloadUrl} download className={action}><Download size={16} />Download</a>}
        <button aria-expanded={tab === 'comments'} aria-controls="video-comments" className={action} onClick={() => setTab(tab === 'comments' ? null : 'comments')}><MessageSquare size={16} />Comments</button>
        <ShareButton />
        <button aria-expanded={tab === 'about'} aria-controls="video-about" aria-pressed={tab === 'about'} className={action} onClick={() => setTab(tab === 'about' ? null : 'about')}><Info size={16} />About</button>
      </div>
      <div id="video-about" hidden={tab !== 'about'} className="mt-4 border-t border-line pt-4 text-[13px] leading-relaxed text-white/70">{description}</div>
      <div id="video-comments" hidden={tab !== 'comments'} className="mt-4 border-t border-line pt-4 text-[13px] text-white/60">No comments yet.</div>
    </div>
  );
}
