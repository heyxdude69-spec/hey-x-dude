'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, LoaderCircle, RotateCw } from 'lucide-react';
import type { VideoServer } from '@/data/catalog';

export default function EmbedPlayer({ title, servers }: { title: string; servers: VideoServer[] }) {
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [notice, setNotice] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  const playback = useRef({ time: 0, playing: false });
  const embedUrl = servers[active]?.embedUrl;

  const fail = useCallback(() => {
    const next = servers.findIndex((server, index) => index > active && server.embedUrl);
    if (next >= 0) {
      setActive(next);
      setStatus('loading');
      setNotice(`Server ${active + 1} failed. Switched to Server ${next + 1}.`);
    } else setStatus('error');
  }, [active, servers]);

  useEffect(() => {
    setMounted(true);
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'demo-player-error') fail();
      if (event.data?.type === 'demo-player-progress' && Number.isFinite(event.data.time) && event.data.time >= 0) playback.current = { time: event.data.time, playing: event.data.playing === true };
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [fail]);

  useEffect(() => {
    if (!embedUrl || status !== 'loading') return;
    const timeout = window.setTimeout(fail, 20000);
    return () => window.clearTimeout(timeout);
  }, [embedUrl, attempt, status, fail]);

  function selectServer(index: number) {
    setActive(index);
    setStatus('loading');
    setAttempt(current => current + 1);
    setNotice('');
  }

  return (
    <div>
      <div role="group" aria-label="Video servers" className="mb-2 flex flex-wrap gap-2">
        {servers.map((server, index) => <button key={server.provider} aria-pressed={active === index} onClick={() => selectServer(index)} className="badge cursor-pointer px-3 py-2 transition-colors hover:border-accent hover:text-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white">Server {index + 1}</button>)}
      </div>
      <p className="mb-3 text-[11px] text-muted">If a server isn't working, switch to another one.</p>
      <p aria-live="polite" className="text-[11px] text-muted">{notice}</p>
      <div className="relative aspect-video w-full overflow-hidden bg-black" aria-label="Video player" aria-busy={!!embedUrl && status === 'loading'}>
        {mounted && embedUrl && status !== 'error' && <iframe key={`${active}-${attempt}`} ref={frame} src={embedUrl} title={`${title} — Server ${active + 1}`} className="absolute inset-0 h-full w-full border-0" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen onLoad={event => {
          if (event.currentTarget !== frame.current) return;
          setStatus(current => current === 'error' ? current : 'ready');
          if (embedUrl.startsWith('/demo/player.html')) frame.current?.contentWindow?.postMessage({ type: 'demo-player-resume', ...playback.current }, window.location.origin);
        }} onError={event => { if (event.currentTarget === frame.current) fail(); }} />}
        {(!embedUrl || status !== 'ready') && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black p-4 text-center" role="status">
          {embedUrl && status === 'loading' ? <LoaderCircle size={28} className="animate-spin text-accent motion-reduce:animate-none" /> : <AlertCircle size={28} className="text-muted" />}
          <p className="text-[13px] text-white/75">{!embedUrl ? 'This video is currently unavailable.' : status === 'loading' ? `Loading Server ${active + 1}…` : 'The servers could not be loaded. Please try again.'}</p>
          {embedUrl && status === 'error' && <button onClick={() => selectServer(0)} className="badge cursor-pointer hover:border-accent hover:text-accent"><RotateCw size={14} />Retry servers</button>}
        </div>}
      </div>
      {embedUrl && status === 'ready' && <div className="mt-2 flex justify-end"><button onClick={() => selectServer(active)} className="flex items-center gap-1.5 text-[11px] text-muted hover:text-accent"><RotateCw size={12} />Reload player</button></div>}
    </div>
  );
}
