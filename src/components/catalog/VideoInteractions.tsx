'use client';
import { createContext, useContext, useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { Eye, Info, MessageSquare, ThumbsDown, ThumbsUp } from 'lucide-react';
import ShareButton from './ShareButton';
type Vote = 'like' | 'dislike' | null;
type State = { views: string; rating: number | null; vote: Vote; ready: boolean; busy: boolean; error: string; voteFor: (vote: Vote) => void };
const Context = createContext<State | null>(null);
async function api(slug: string, resource: string, body?: unknown, query = '') {
  const response = await fetch(`/api/videos/${slug}/${resource}${query}`, { method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
  return data;
}
export function VideoInteractionProvider({ slug, initialViews, initialRating, children }: { slug: string; initialViews: string; initialRating: number | null; children: ReactNode }) {
  const [views, setViews] = useState(initialViews), [rating, setRating] = useState(initialRating);
  const [vote, setVote] = useState<Vote>(null), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  function apply(data: { views: number; rating: number | null; vote: Vote }) {
    setViews(new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(data.views));
    setRating(data.rating); setVote(data.vote);
  }
  useEffect(() => {
    let cancelled = false;
    api(slug, 'interactions').then(data => { if (!cancelled) { apply(data); setReady(true); } }).catch(() => { if (!cancelled) setError('Interactions are temporarily unavailable.'); });
    return () => { cancelled = true; };
  }, [slug]);
  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined, counted = false;
    function schedule() {
      if (timer) clearTimeout(timer);
      if (document.visibilityState === 'visible' && !counted) timer = setTimeout(() => {
        counted = true;
        api(slug, 'interactions', { action: 'view' }).then(data => setViews(new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(data.views))).catch(() => {});
      }, 10000);
    }
    schedule(); document.addEventListener('visibilitychange', schedule);
    return () => { if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', schedule); };
  }, [ready, slug]);
  async function voteFor(next: Vote) {
    if (busy || !ready) return;
    setBusy(true); setError('');
    try { apply(await api(slug, 'interactions', { action: 'vote', vote: next === vote ? null : next })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Vote failed.'); }
    finally { setBusy(false); }
  }
  return <Context.Provider value={{ views, rating, vote, ready, busy, error, voteFor }}>{children}</Context.Provider>;
}
type Comment = { id: string; name: string; text: string; createdAt: string };
const action = 'inline-flex h-10 max-sm:min-h-11 max-sm:justify-center items-center gap-2 rounded-md border border-line bg-card px-3 text-[12px] text-white transition-colors hover:border-accent hover:text-accent aria-pressed:border-accent aria-pressed:text-accent';
export default function VideoInteractions({ slug, header = false, description = '', bodyText = '' }: { slug: string; header?: boolean; description?: string; bodyText?: string }) {
  const state = useContext(Context);
  const [tab, setTab] = useState<'about' | 'comments' | null>(null);
  const [comments, setComments] = useState<Comment[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false), [loading, setLoading] = useState(false), [notice, setNotice] = useState('');
  const [name, setName] = useState(''), [text, setText] = useState(''), [submissionId, setSubmissionId] = useState<string | null>(null);
  if (!state) throw new Error('Missing video interaction provider');
  async function loadComments(more = false) {
    setLoading(true); setNotice('');
    try { const data = await api(slug, 'comments', undefined, more && cursor ? `?before=${cursor}` : '');
      setComments(previous => more ? [...previous, ...data.comments] : data.comments); setCursor(data.nextCursor); setLoaded(true);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Comments unavailable.'); }
    finally { setLoading(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (loading) return;
    setLoading(true); setNotice('');
    const requestId = submissionId || crypto.randomUUID(); setSubmissionId(requestId);
    try { await api(slug, 'comments', { name, text, requestId }); setText(''); setSubmissionId(null); setNotice('Comment submitted. It will appear after approval.'); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Comment could not be submitted.'); }
    finally { setLoading(false); }
  }
  if (header) return <><span className="flex items-center gap-1.5 text-[12px] text-white/60"><Eye size={16} />{state.views} views</span><span className="flex items-center gap-1.5 text-[12px] text-white/60"><ThumbsUp size={16} />{state.rating === null ? '—' : `${state.rating}%`}</span></>;
  return <div className="mt-3">
    <div className="flex flex-wrap items-center gap-2">
      <div className="mr-2 max-sm:mr-0 flex items-center overflow-hidden rounded-md border border-line bg-card">
        <button disabled={!state.ready || state.busy} aria-label="Like video" aria-pressed={state.vote === 'like'} onClick={() => state.voteFor('like')} className="h-10 max-sm:min-h-11 max-sm:min-w-11 px-3 text-white hover:text-accent aria-pressed:text-accent disabled:opacity-40"><ThumbsUp size={16} /></button>
        <span className="border-x border-line px-3 text-[12px]">{state.rating === null ? '—' : `${state.rating}%`}</span>
        <button disabled={!state.ready || state.busy} aria-label="Dislike video" aria-pressed={state.vote === 'dislike'} onClick={() => state.voteFor('dislike')} className="h-10 max-sm:min-h-11 max-sm:min-w-11 px-3 text-white hover:text-accent aria-pressed:text-accent disabled:opacity-40"><ThumbsDown size={16} /></button>
      </div>
      <button aria-expanded={tab === 'comments'} aria-controls="video-comments" className={action} onClick={() => { setTab(tab === 'comments' ? null : 'comments'); if (!loaded && !loading) void loadComments(); }}><MessageSquare size={16} />Comments</button>
      <ShareButton />
      <button aria-expanded={tab === 'about'} aria-controls="video-about" aria-pressed={tab === 'about'} className={action} onClick={() => setTab(tab === 'about' ? null : 'about')}><Info size={16} />About</button>
    </div>
    <p role="status" className="mt-2 text-[11px] text-muted">{state.error}</p>
    <div id="video-about" hidden={tab !== 'about'} className="mt-4 border-t border-line pt-4 text-[13px] leading-relaxed text-white/70 [overflow-wrap:anywhere]"><p>{description}</p>{bodyText && bodyText !== description && <p className="mt-3 whitespace-pre-wrap">{bodyText}</p>}</div>
    <div id="video-comments" hidden={tab !== 'comments'} className="mt-4 border-t border-line pt-4 text-[13px] text-white/60">
      {loaded && !comments.length && <p>No comments yet.</p>}
      {comments.map(comment => <article key={comment.id} className="mb-4"><strong className="text-white [overflow-wrap:anywhere]">{comment.name}</strong><p className="whitespace-pre-wrap break-words">{comment.text}</p></article>)}
      {cursor && <button disabled={loading} className={action} onClick={() => void loadComments(true)}>More comments</button>}
      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block">Name<input required maxLength={80} value={name} onChange={e => { setName(e.target.value); setSubmissionId(null); }} className="mt-1 block w-full min-w-0 rounded-md border border-line bg-card px-3 py-2 text-white max-sm:text-[16px] max-sm:min-h-11" /></label>
        <label className="block">Comment<textarea required maxLength={2000} rows={3} value={text} onChange={e => { setText(e.target.value); setSubmissionId(null); }} className="mt-1 block w-full min-w-0 rounded-md border border-line bg-card px-3 py-2 text-white max-sm:text-[16px] max-sm:min-h-11" /></label>
        <button disabled={loading || !state.ready} className={`${action} max-sm:w-full`}>Submit comment</button>
        <p className="text-[11px] text-muted">Comments appear after approval.</p>
      </form>
      <p role="status" className="mt-2 text-[11px] text-muted">{loading ? 'Loading…' : notice}</p>
    </div>
  </div>;
}
