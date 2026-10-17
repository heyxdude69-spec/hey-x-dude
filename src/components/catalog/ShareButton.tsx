'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';

export default function ShareButton() {
  const [status, setStatus] = useState('');

  async function share() {
    const url = `${window.location.origin}${window.location.pathname}`;
    try {
      if (navigator.share) await navigator.share({ title: document.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setStatus('Link copied');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setStatus('Could not share. Copy the link from your address bar.');
    }
  }

  return (
    <div className="relative text-center">
      <button onClick={share} className="inline-flex h-10 max-sm:min-h-11 items-center gap-2 rounded-md border border-line bg-card px-3 text-[12px] text-white transition-colors hover:border-accent hover:text-accent max-sm:text-[11px]"><Share2 size={16} />Share</button>
      <p aria-live="polite" className="absolute top-full right-0 z-10 mt-2 w-44 text-[11px] text-white/60">{status}</p>
    </div>
  );
}
