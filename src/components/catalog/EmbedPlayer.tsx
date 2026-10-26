'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, LoaderCircle, RotateCw, Play } from 'lucide-react';
import CategoryPoster from './CategoryPoster';
type VideoServer = { id?: string; provider: string; embedUrl: string; kind?: 'embed' | 'direct' };

export default function EmbedPlayer({ title, servers, poster, posterFallbacks }: { title: string; servers: VideoServer[]; poster?: string; posterFallbacks?: string[] }) {
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [started, setStarted] = useState(false);
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
    if (!started || !embedUrl || status !== 'loading') return;
    const timeout = window.setTimeout(fail, 20000);
    return () => window.clearTimeout(timeout);
  }, [started, embedUrl, attempt, status, fail]);

  function selectServer(index: number) {
    setActive(index);
    setStatus('loading');
    setAttempt(current => current + 1);
    setNotice('');
  }

  return (
    <div>
      <div role="group" aria-label="Video servers" className="mb-2 flex flex-wrap gap-2">
        {servers.map((server, index) => <button key={server.id || `${server.provider}-${index}`} aria-pressed={active === index} onClick={() => selectServer(index)} className="badge cursor-pointer px-3 py-2 max-sm:min-h-11 max-sm:min-w-20 transition-colors hover:border-accent hover:text-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white">Server {index + 1}</button>)}
      </div>
      <p className="mb-3 text-[11px] text-muted">If a server isn't working, switch to another one.</p>
      <p aria-live="polite" className="text-[11px] text-muted">{notice}</p>
      <div className="relative aspect-video w-full overflow-hidden bg-black" aria-label="Video player" aria-busy={started && !!embedUrl && status === 'loading'}>
        {started && embedUrl && status !== 'error' && servers[active]?.kind !== 'direct' && <iframe key={`${active}-${attempt}`} ref={frame} src={embedUrl} title={`${title} — Server ${active + 1}`} className="absolute inset-0 h-full w-full border-0" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen onLoad={event => {
          if (event.currentTarget !== frame.current) return;
          setStatus(current => current === 'error' ? current : 'ready');
        }} onError={event => { if (event.currentTarget === frame.current) fail(); }} />}
        {started && embedUrl && status !== 'error' && servers[active]?.kind === 'direct' && <video key={`${active}-${attempt}`} src={embedUrl} controls preload="metadata" className="absolute inset-0 h-full w-full" aria-label={title}
          onLoadedMetadata={event => { setStatus('ready'); if (playback.current.time < event.currentTarget.duration) event.currentTarget.currentTime = playback.current.time; }}
          onTimeUpdate={event => { playback.current = { time: event.currentTarget.currentTime, playing: !event.currentTarget.paused }; }} onError={fail} />}
        {!started && embedUrl && <button onClick={() => setStarted(true)} className="absolute inset-0 z-10 flex h-full w-full items-center justify-center focus-visible:outline-offset-[-4px]" aria-label={`Play ${title}`}><CategoryPoster url={poster} fallbackUrls={posterFallbacks} alt="" priority sizes="(max-width: 700px) 100vw, 1000px" /><span className="absolute inset-0 bg-black/25" /><span className="relative grid size-16 place-items-center rounded-full border border-white/40 bg-accent text-white shadow-lg transition-transform hover:scale-105 motion-reduce:transition-none max-sm:size-14"><Play size={28} fill="currentColor" aria-hidden="true" /></span></button>}
        {(!embedUrl || (started && status !== 'ready')) && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black p-4 text-center" role="status">
          {embedUrl && status === 'loading' ? <LoaderCircle size={28} className="animate-spin text-accent motion-reduce:animate-none" /> : <AlertCircle size={28} className="text-muted" />}
          <p className="text-[13px] text-white/75">{!embedUrl ? 'This video is currently unavailable.' : status === 'loading' ? `Loading Server ${active + 1}…` : 'The servers could not be loaded. Please try again.'}</p>
          {embedUrl && status === 'error' && <button onClick={() => selectServer(0)} className="badge cursor-pointer max-sm:min-h-11 hover:border-accent hover:text-accent"><RotateCw size={14} />Retry servers</button>}
        </div>}
      </div>
      {embedUrl && status === 'ready' && <div className="mt-2 flex justify-end"><button onClick={() => selectServer(active)} className="flex items-center gap-1.5 max-sm:min-h-11 max-sm:px-2 text-[11px] text-muted hover:text-accent"><RotateCw size={12} />Reload player</button></div>}
    </div>
  );
}
