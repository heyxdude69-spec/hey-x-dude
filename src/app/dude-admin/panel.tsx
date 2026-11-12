'use client';

import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { Activity, ArrowLeft, ArrowRight, BadgeCheck, Clapperboard, CircleHelp, Film, FolderPlus, Gauge, LayoutDashboard, LockKeyhole, LogOut, Play, Plus, RefreshCw, Search, ShieldCheck, Tags, Upload, X } from 'lucide-react';
import styles from './panel.module.css';

type Tab = 'Overview' | 'Videos' | 'Add video' | 'Categories';
type VideoRow = { _id: string; slug: string; title: string; status: 'draft' | 'published' | 'archived'; tags?: string[]; createdAt?: string; updatedAt?: string };
type Category = { _id: string; slug: string; name: string; description?: string; seo?: { title?: string; metaDescription?: string }; contentRating: 'general' | 'adult'; status: 'draft' | 'active' | 'archived' };
type Source = { _id: string; provider: string; externalVideoId: string; kind: 'embed' | 'direct'; embedUrl?: string; contentUrl?: string; status: string; enabled: boolean; priority: number };
type VideoDetails = VideoRow & { description?: string; h1?: string; thumbnail?: { url?: string; alt?: string }; uploadDate?: string; contentRating?: string; categories?: string[]; seo?: { title?: string; metaDescription?: string }; sources: Source[] };
type VideoDraft = { title: string; slug: string; description: string; uploadDate: string; contentRating: 'general' | 'adult'; categories: string[]; tags: string[]; provider: string; thumbnailUrl: string; seoTitle: string; seoDescription: string };
type SourceDraft = { provider: string; externalVideoId: string; kind: 'embed' | 'direct'; url: string; status: 'processing' | 'ready' };

const menu: { name: Tab; icon: typeof LayoutDashboard; hint: string }[] = [
  { name: 'Overview', icon: LayoutDashboard, hint: 'Your catalog at a glance' },
  { name: 'Videos', icon: Film, hint: 'Manage every catalog entry' },
  { name: 'Add video', icon: Plus, hint: 'Create and connect a video' },
  { name: 'Categories', icon: Tags, hint: 'Organize the catalog' },
];
const blankVideo: VideoDraft = { title: '', slug: '', description: '', uploadDate: '', contentRating: 'general', categories: [], tags: [], provider: 'voe', thumbnailUrl: '', seoTitle: '', seoDescription: '' };
const blankSource: SourceDraft = { provider: 'voe', externalVideoId: '', kind: 'embed', url: '', status: 'processing' };
const slugify = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180);

async function api(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api/dude-admin/proxy/${path}`, { ...init, cache: 'no-store', headers });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error('Admin session expired. Sign in again.');
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

export default function DudeAdminPanel() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(true);
  const [tab, setTab] = useState<Tab>('Overview');
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<VideoDetails | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [videoDraft, setVideoDraft] = useState<VideoDraft>(blankVideo);
  const [sourceDraft, setSourceDraft] = useState<SourceDraft>(blankSource);
  const [categoryDraft, setCategoryDraft] = useState({ name: '', slug: '', contentRating: 'general', description: '', seoTitle: '', seoDescription: '', status: 'draft' });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const loadCatalog = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [videoData, categoryData] = await Promise.all([
        api('videos?limit=48'), api('categories'),
      ]);
      setVideos(videoData.videos || []); setCategories(categoryData.categories || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the catalog'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch('/api/dude-admin/session', { cache: 'no-store' }).then(r => r.json()).then(data => { setConfigured(data.configured === true); setAuthenticated(data.authenticated === true); }).catch(() => { setConfigured(false); setAuthenticated(false); });
  }, []);
  useEffect(() => { if (authenticated) void loadCatalog(); }, [authenticated, loadCatalog]);

  const filteredVideos = useMemo(() => videos.filter(video => {
    const matchesText = `${video.title} ${video.slug} ${(video.tags || []).join(' ')}`.toLowerCase().includes(search.toLowerCase());
    return matchesText && (statusFilter === 'all' || video.status === statusFilter);
  }), [videos, search, statusFilter]);
  const activeCategories = categories.filter(category => category.status === 'active' && category.contentRating === videoDraft.contentRating);
  const availableTags = [...new Set(videos.flatMap(video => video.tags || []))].sort((a, b) => a.localeCompare(b));

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/dude-admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: loginPassword }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not sign in');
      setAuthenticated(true); setLoginPassword('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in'); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch('/api/dude-admin/session', { method: 'DELETE' }).catch(() => undefined);
    setAuthenticated(false); setSelected(null); setVideos([]); setCategories([]);
  }

  async function openVideo(id: string) {
    setBusy(true); setError('');
    try { const data = await api(`videos/${id}`); setSelected({ ...data.video, sources: data.sources || [] }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load video'); }
    finally { setBusy(false); }
  }

  async function createVideo(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const data = await api('videos', { method: 'POST', body: JSON.stringify({
        slug: videoDraft.slug || slugify(videoDraft.title), title: videoDraft.title, h1: videoDraft.title,
        description: videoDraft.description, bodyText: videoDraft.description, contentRating: videoDraft.contentRating,
        categories: videoDraft.categories, tags: videoDraft.tags,
        ...(videoDraft.uploadDate ? { uploadDate: new Date(`${videoDraft.uploadDate}T12:00:00.000Z`).toISOString() } : {}),
        ...(videoDraft.thumbnailUrl ? { thumbnail: { url: videoDraft.thumbnailUrl, alt: videoDraft.title } } : {}),
        seo: { title: videoDraft.seoTitle || videoDraft.title, metaDescription: videoDraft.seoDescription || videoDraft.description, indexAllowed: true },
        status: 'draft', language: 'en',
      }) });
      setNotice('Draft created. Add a provider source below, then publish when it is verified and the required details are complete.');
      setSourceDraft({ ...blankSource, provider: videoDraft.provider });
      setVideoDraft(blankVideo); await loadCatalog();
      const created = data.video;
      if (created?._id) { setTab('Videos'); await openVideo(created._id); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create draft'); }
    finally { setBusy(false); }
  }

  async function addSource(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (sourceDraft.status === 'ready' && !window.confirm('Have you checked the provider dashboard and confirmed this exact embed plays?')) return;
      await api(`videos/${selected._id}/sources`, { method: 'POST', body: JSON.stringify({ provider: sourceDraft.provider, externalVideoId: sourceDraft.externalVideoId,
        kind: sourceDraft.kind, ...(sourceDraft.kind === 'embed' ? { embedUrl: sourceDraft.url } : { contentUrl: sourceDraft.url }),
        enabled: true, priority: selected.sources.length * 10 + 10, status: sourceDraft.status, availability: sourceDraft.status === 'ready' ? 'available' : 'unknown' }) });
      setSourceDraft(blankSource);
      if (sourceDraft.provider === 'voe') {
        try { await api(`videos/${selected._id}`, { method: 'PATCH', body: JSON.stringify({ thumbnail: {
          url: `https://i.voe.sx/cache/${encodeURIComponent(sourceDraft.externalVideoId.trim())}_storyboard_L3.jpg`, alt: selected.title,
        } }) }); }
        catch (e) { await openVideo(selected._id); throw new Error(`Source saved, but the L3 thumbnail update failed: ${e instanceof Error ? e.message : 'request failed'}`); }
      }
      await openVideo(selected._id); setNotice(sourceDraft.provider === 'voe' ? 'VOE source and L3 thumbnail saved.' : 'Provider source saved.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add source'); }
    finally { setBusy(false); }
  }

  async function updateSource(source: Source, status: string) {
    if (status === 'ready' && !window.confirm('Confirm that you checked the provider dashboard and this exact player URL is playable.')) return;
    setBusy(true); setError('');
    try { await api(`sources/${source._id}`, { method: 'PATCH', body: JSON.stringify({ status, availability: status === 'ready' ? 'available' : 'unknown' }) });
      if (selected) await openVideo(selected._id);
      setNotice(`Source marked ${status}.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update source'); }
    finally { setBusy(false); }
  }

  async function changeVideoStatus(status: string) {
    if (!selected) return;
    if (status === 'published' && !window.confirm('Publish this video now? It will become visible on the public site.')) return;
    setBusy(true); setError(''); setNotice('');
    try { await api(`videos/${selected._id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await openVideo(selected._id); await loadCatalog(); setNotice(`Video is now ${status}.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update video'); }
    finally { setBusy(false); }
  }

  async function saveVideoDetails(input: Record<string, unknown>) {
    if (!selected) return;
    setBusy(true); setError(''); setNotice('');
    try { await api(`videos/${selected._id}`, { method: 'PATCH', body: JSON.stringify(input) }); await openVideo(selected._id); await loadCatalog(); setNotice('Video details saved.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save video details'); }
    finally { setBusy(false); }
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const body = { name: categoryDraft.name, description: categoryDraft.description, status: categoryDraft.status,
        seo: { title: categoryDraft.seoTitle, metaDescription: categoryDraft.seoDescription } };
      if (editingCategoryId) await api(`categories/${editingCategoryId}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('categories', { method: 'POST', body: JSON.stringify({ ...body, slug: categoryDraft.slug || slugify(categoryDraft.name), contentRating: categoryDraft.contentRating }) });
      setCategoryDraft({ name: '', slug: '', contentRating: 'general', description: '', seoTitle: '', seoDescription: '', status: 'draft' }); setEditingCategoryId(null); await loadCatalog(); setNotice(categoryDraft.status === 'active' ? 'Category activated.' : 'Category saved.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save category'); }
    finally { setBusy(false); }
  }

  function editCategory(category: Category) {
    setEditingCategoryId(category._id);
    setCategoryDraft({ name: category.name, slug: category.slug, contentRating: category.contentRating, description: category.description || '',
      seoTitle: category.seo?.title || '', seoDescription: category.seo?.metaDescription || '', status: category.status === 'archived' ? 'draft' : category.status });
  }

  async function updateCategory(category: Category) {
    const status = category.status === 'active' ? 'archived' : 'active';
    if (status === 'archived' && !window.confirm(`Archive “${category.name}”?`)) return;
    setBusy(true); setError(''); setNotice('');
    try { await api(`categories/${category._id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await loadCatalog(); setNotice(`Category ${status}.`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update category'); }
    finally { setBusy(false); }
  }

  if (authenticated === null) return <main className={styles.authLoading} data-admin-app><RefreshCw className={styles.spin} /> Checking secure session…</main>;
  if (!authenticated) return <main className={styles.loginPage} data-admin-app>
    <section className={styles.loginCard}>
      <div className={styles.brandMark}><Clapperboard size={22} /></div>
      <p className={styles.eyebrow}>HEYXDUDE · PRIVATE AREA</p>
      <h1>Welcome back.</h1>
      <p className={styles.loginCopy}>Sign in to manage videos, provider sources, and categories.</p>
      {!configured && <p className={styles.configNotice}>Admin panel setup is incomplete. Configure ADMIN_PANEL_PASSWORD, ADMIN_PANEL_SESSION_SECRET, CATALOG_ADMIN_API_TOKEN, and CATALOG_API_ORIGIN on the Next.js server.</p>}
      <form onSubmit={login} className={styles.loginForm}>
        <label htmlFor="admin-password">Admin password</label>
        <input id="admin-password" type="password" autoComplete="current-password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.primaryButton} disabled={busy || !configured}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} /></button>
      </form>
      <div className={styles.secureNote}><LockKeyhole size={15} /> Secure, private admin session</div>
    </section>
  </main>;

  return <main className={styles.app} data-admin-app>
    <aside className={styles.sidebar}>
      <a href="/" className={styles.brand}><span className={styles.brandIcon}><Clapperboard size={19} /></span><span>heyxdude<span className={styles.brandDot}>.</span><small>CONTROL ROOM</small></span></a>
      <div className={styles.sideLabel}>WORKSPACE</div>
      <nav className={styles.nav} aria-label="Admin navigation">
        {menu.map(item => { const Icon = item.icon; return <button key={item.name} className={`${styles.navItem} ${tab === item.name ? styles.navActive : ''}`} onClick={() => { setTab(item.name); setError(''); setNotice(''); }}>
          <Icon size={18} strokeWidth={1.8} /><span>{item.name}</span>{item.name === 'Add video' && <span className={styles.navPlus}>+</span>}
        </button>; })}
      </nav>
      <div className={styles.sidebarBottom}>
        <div className={styles.systemCard}><span className={styles.systemDot} /><div><b>Private panel</b><small>Session protected</small></div><ShieldCheck size={17} /></div>
        <button className={styles.navItem} onClick={logout}><LogOut size={18} /><span>Sign out</span></button>
      </div>
    </aside>

    <section className={styles.mainColumn}>
      <header className={styles.topbar}>
        <div className={styles.breadcrumb}>Workspace <span>/</span> <b>{tab}</b></div>
        <div className={styles.topActions}><span className={styles.liveStatus}><i /> Admin session active</span><button className={styles.iconButton} aria-label="Refresh catalog" onClick={() => void loadCatalog()}><RefreshCw size={17} className={loading ? styles.spin : ''} /></button><button className={styles.iconButton} aria-label="Sign out" onClick={logout}><LogOut size={16} /></button><span className={styles.avatar}>A</span></div>
      </header>
      <div className={styles.content}>
        {(error || notice) && <div className={`${styles.notice} ${error ? styles.noticeError : ''}`} role={error ? 'alert' : 'status'}>{error || notice}<button aria-label="Dismiss" onClick={() => { setError(''); setNotice(''); }}><X size={16} /></button></div>}
        {tab === 'Overview' && <>
          <div className={styles.pageHeading}><div><p className={styles.eyebrow}>CATALOG CONTROL ROOM</p><h1>Good day, Admin <span>✦</span></h1><p className={styles.subheading}>Your catalog workspace, all in one place.</p></div><button className={styles.primaryButton} onClick={() => setTab('Add video')}><Plus size={17} /> Add a video</button></div>
          <div className={styles.metricGrid}>
            <Metric icon={Film} label="Recent videos" value={videos.length} note="Latest 48 records" tone="violet" />
            <Metric icon={BadgeCheck} label="Published" value={videos.filter(v => v.status === 'published').length} note="In the loaded records" tone="green" />
            <Metric icon={Activity} label="Drafts" value={videos.filter(v => v.status === 'draft').length} note="Ready for your review" tone="amber" />
            <Metric icon={Tags} label="Active categories" value={categories.filter(c => c.status === 'active').length} note={`${categories.length} total categories`} tone="blue" />
          </div>
          <div className={styles.overviewGrid}>
            <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Recently added</h2><p>Your newest catalog records</p></div><button className={styles.textButton} onClick={() => setTab('Videos')}>View all <ArrowRight size={15} /></button></div>
              <VideoTable videos={videos.slice(0, 6)} onSelect={id => void openVideo(id)} compact />
            </section>
            <section className={`${styles.panel} ${styles.workflowPanel}`}><div className={styles.workflowIcon}><Gauge size={20} /></div><p className={styles.eyebrow}>PUBLISHING WORKFLOW</p><h2>From draft to live.</h2><p className={styles.workflowText}>Create a draft, attach a provider player, verify playback, then publish. The backend checks category, metadata, and provider rules before it goes live.</p><div className={styles.workflowSteps}><span><i>1</i> Details</span><ArrowRight size={14} /><span><i>2</i> Source</span><ArrowRight size={14} /><span><i>3</i> Publish</span></div><button className={styles.secondaryButton} onClick={() => setTab('Add video')}>Start with a video <ArrowRight size={16} /></button></section>
          </div>
          <div className={styles.infoStrip}><CircleHelp size={17} /><p><b>Provider uploads run separately.</b> This panel manages catalog records and verified provider embeds. Use the private upload worker/CLI for media transfer; it is not exposed by the deployed API yet.</p></div>
        </>}
        {tab === 'Videos' && <>
          <div className={styles.pageHeading}><div><p className={styles.eyebrow}>CATALOG MANAGEMENT</p><h1>Your videos</h1><p className={styles.subheading}>Review records, providers, and publishing status.</p></div><button className={styles.primaryButton} onClick={() => { setTab('Add video'); setSelected(null); }}><Plus size={17} /> New video</button></div>
          <section className={styles.panel}><div className={styles.toolbar}><div className={styles.searchBox}><Search size={17} /><input aria-label="Search videos" placeholder="Search title, slug, or tag…" value={search} onChange={e => setSearch(e.target.value)} /></div><select aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select><span className={styles.resultCount}>{filteredVideos.length} shown</span></div><VideoTable videos={filteredVideos} onSelect={id => void openVideo(id)} /></section>
          {selected && <VideoDetail video={selected} categories={categories} busy={busy} sourceDraft={sourceDraft} setSourceDraft={setSourceDraft} onClose={() => setSelected(null)} onAddSource={addSource} onSourceStatus={updateSource} onVideoStatus={changeVideoStatus} onSave={saveVideoDetails} />}
        </>}
        {tab === 'Add video' && <>
          <div className={styles.pageHeading}><div><p className={styles.eyebrow}>NEW CATALOG ENTRY</p><h1>Add a video</h1><p className={styles.subheading}>Start with accurate details. You can save as a draft and finish later.</p></div><span className={styles.stepPill}><span>01</span> Video details</span></div>
          <form className={styles.editorGrid} onSubmit={createVideo}>
            <section className={styles.panel}><div className={styles.sectionTitle}><div className={styles.sectionIcon}><Film size={18} /></div><div><h2>Video details</h2><p>How it appears in your catalog</p></div></div>
              <div className={styles.formGrid}><Field label="Video title" required><input required maxLength={300} value={videoDraft.title} onChange={e => setVideoDraft({ ...videoDraft, title: e.target.value, slug: videoDraft.slug ? videoDraft.slug : slugify(e.target.value), seoTitle: videoDraft.seoTitle || e.target.value })} placeholder="Enter a clear, accurate title" /></Field>
                <Field label="Slug" hint="URL path; can be edited before save"><input required maxLength={180} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={videoDraft.slug} onChange={e => setVideoDraft({ ...videoDraft, slug: slugify(e.target.value) })} placeholder="video-title" /></Field>
                <Field label="Upload provider" required><select value={videoDraft.provider} onChange={e => setVideoDraft({ ...videoDraft, provider: e.target.value })}><option value="voe">VOE</option><option value="playmate">Playmate</option><option value="vidara">Vidara</option><option value="lulustream">LuluStream</option></select></Field>
                <Field label="Content rating" required><select value={videoDraft.contentRating} onChange={e => setVideoDraft({ ...videoDraft, contentRating: e.target.value as VideoDraft['contentRating'], categories: [] })}><option value="general">General</option><option value="adult">Adult</option></select></Field>
                <Field label="Original upload date" hint="Use the actual first publication date"><input type="date" value={videoDraft.uploadDate} onChange={e => setVideoDraft({ ...videoDraft, uploadDate: e.target.value })} /></Field>
                <Field label="Description" wide required><textarea required maxLength={5000} rows={4} value={videoDraft.description} onChange={e => setVideoDraft({ ...videoDraft, description: e.target.value, seoDescription: videoDraft.seoDescription || e.target.value })} placeholder="Write an accurate summary for viewers." /></Field>
                <Field label="Categories" wide hint="Only active categories with the same rating can be published"><div className={styles.categoryChoices}>{activeCategories.length ? activeCategories.map(category => <label className={styles.checkChoice} key={category._id}><input type="checkbox" checked={videoDraft.categories.includes(category.slug)} onChange={e => setVideoDraft({ ...videoDraft, categories: e.target.checked ? [...videoDraft.categories, category.slug] : videoDraft.categories.filter(slug => slug !== category.slug) })} /><span>{category.name}</span></label>) : <span className={styles.emptyHint}>No active {videoDraft.contentRating} categories yet. Add one in Categories.</span>}</div></Field>
                <Field label="Tags" wide hint="Choose from tags already used in the catalog"><div className={styles.categoryChoices}>{availableTags.length ? availableTags.map(tag => <label className={styles.checkChoice} key={tag}><input type="checkbox" checked={videoDraft.tags.includes(tag)} onChange={e => setVideoDraft({ ...videoDraft, tags: e.target.checked ? [...videoDraft.tags, tag] : videoDraft.tags.filter(value => value !== tag) })} /><span>{tag}</span></label>) : <span className={styles.emptyHint}>No tags in the loaded catalog yet.</span>}</div></Field>
              </div>
            </section>
            <aside className={styles.editorAside}>
              <section className={styles.panel}><div className={styles.sectionTitle}><div className={`${styles.sectionIcon} ${styles.pinkIcon}`}><Upload size={18} /></div><div><h2>Thumbnail & SEO</h2><p>Required before publishing</p></div></div>
                <Field label="Public thumbnail URL" hint="HTTPS image URL"><input type="url" value={videoDraft.thumbnailUrl} onChange={e => setVideoDraft({ ...videoDraft, thumbnailUrl: e.target.value })} placeholder="https://…" /></Field>
                <div className={styles.fieldGap}><Field label="SEO title"><input maxLength={300} value={videoDraft.seoTitle} onChange={e => setVideoDraft({ ...videoDraft, seoTitle: e.target.value })} placeholder="Search result title" /></Field></div>
                <div className={styles.fieldGap}><Field label="SEO description"><textarea rows={3} maxLength={1000} value={videoDraft.seoDescription} onChange={e => setVideoDraft({ ...videoDraft, seoDescription: e.target.value })} placeholder="Short search description" /></Field></div>
              </section>
              <section className={`${styles.panel} ${styles.reviewNote}`}><ShieldCheck size={18} /><div><b>Saved as a draft</b><p>Nothing is public until you attach a verified provider source and choose Publish.</p></div></section>
              <button className={styles.primaryButton} disabled={busy || !videoDraft.title || !videoDraft.description}>{busy ? 'Saving…' : 'Create draft'} <ArrowRight size={16} /></button>
            </aside>
          </form>
        </>}
        {tab === 'Categories' && <>
          <div className={styles.pageHeading}><div><p className={styles.eyebrow}>CATALOG TAXONOMY</p><h1>Categories</h1><p className={styles.subheading}>Keep categories consistent with each video's content rating.</p></div><span className={styles.stepPill}>{categories.length} categories</span></div>
          <div className={styles.categoryLayout}><section className={styles.panel}><div className={styles.panelHeader}><div><h2>All categories</h2><p>Draft and active categories</p></div><RefreshCw size={17} className={loading ? styles.spin : ''} /></div>
            <div className={styles.categoryList}>{categories.map(category => <div className={styles.categoryRow} key={category._id}><div className={styles.categoryBadge}><Tags size={17} /></div><div className={styles.categoryIdentity}><b>{category.name}</b><span>/{category.slug}</span></div><span className={`${styles.ratingTag} ${category.contentRating === 'adult' ? styles.adultTag : ''}`}>{category.contentRating}</span><StatusPill status={category.status} /><button className={styles.categoryAction} disabled={busy} onClick={() => editCategory(category)}>Edit</button>{category.status !== 'archived' && <button className={styles.categoryAction} disabled={busy} onClick={() => void updateCategory(category)}>{category.status === 'active' ? 'Archive' : 'Activate'}</button>}</div>)}{!categories.length && <Empty icon={Tags} title="No categories yet" copy="Create a category to organize videos." />}</div>
          </section><form className={styles.panel} onSubmit={saveCategory}><div className={styles.sectionTitle}><div className={styles.sectionIcon}><FolderPlus size={18} /></div><div><h2>{editingCategoryId ? 'Edit category' : 'Create a category'}</h2><p>Set SEO details to activate, or save as a draft</p></div></div><Field label="Category name" required><input required maxLength={150} value={categoryDraft.name} onChange={e => setCategoryDraft({ ...categoryDraft, name: e.target.value, slug: categoryDraft.slug ? categoryDraft.slug : slugify(e.target.value), seoTitle: categoryDraft.seoTitle || e.target.value })} placeholder="e.g. Travel" /></Field><div className={styles.fieldGap}><Field label="Slug"><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={categoryDraft.slug} readOnly={!!editingCategoryId} onChange={e => setCategoryDraft({ ...categoryDraft, slug: slugify(e.target.value) })} placeholder="travel" /></Field></div><div className={styles.fieldGap}><Field label="Content rating"><select value={categoryDraft.contentRating} disabled={!!editingCategoryId} onChange={e => setCategoryDraft({ ...categoryDraft, contentRating: e.target.value })}><option value="general">General</option><option value="adult">Adult</option></select></Field></div><div className={styles.fieldGap}><Field label="Description"><textarea rows={3} maxLength={5000} value={categoryDraft.description} onChange={e => setCategoryDraft({ ...categoryDraft, description: e.target.value, seoDescription: categoryDraft.seoDescription || e.target.value })} placeholder="What belongs in this category?" /></Field></div><div className={styles.fieldGap}><Field label="SEO title"><input maxLength={300} value={categoryDraft.seoTitle} onChange={e => setCategoryDraft({ ...categoryDraft, seoTitle: e.target.value })} placeholder="Search title" /></Field></div><div className={styles.fieldGap}><Field label="SEO description"><textarea rows={2} maxLength={1000} value={categoryDraft.seoDescription} onChange={e => setCategoryDraft({ ...categoryDraft, seoDescription: e.target.value })} placeholder="Search description" /></Field></div><div className={styles.fieldGap}><Field label="Status"><select value={categoryDraft.status} onChange={e => setCategoryDraft({ ...categoryDraft, status: e.target.value })}><option value="draft">Draft</option><option value="active">Active</option></select></Field></div><button disabled={busy || !categoryDraft.name} className={`${styles.secondaryButton} ${styles.fullButton}`}><Plus size={16} /> {editingCategoryId ? 'Save changes' : 'Save category'}</button>{editingCategoryId && <button type="button" className={`${styles.categoryAction} ${styles.fullButton}`} onClick={() => { setEditingCategoryId(null); setCategoryDraft({ name: '', slug: '', contentRating: 'general', description: '', seoTitle: '', seoDescription: '', status: 'draft' }); }}>Cancel edit</button>}<p className={styles.formFootnote}>Active categories require a description, SEO title, and SEO description.</p></form></div>
        </>}
        <footer className={styles.pageFooter}><span>HEYXDUDE CONTROL ROOM</span><span>Private catalog tools</span></footer>
      </div>
    </section>
  </main>;
}

function Metric({ icon: Icon, label, value, note, tone }: { icon: typeof Film; label: string; value: number; note: string; tone: string }) {
  return <article className={styles.metricCard}><div className={`${styles.metricIcon} ${styles[tone]}`}><Icon size={19} /></div><div className={styles.metricLabel}>{label}</div><strong>{value}</strong><span>{note}</span></article>;
}
function Field({ label, hint, required, wide, children }: { label: string; hint?: string; required?: boolean; wide?: boolean; children: ReactNode }) {
  const labelId = `admin-field-${slugify(label)}`;
  const control = isValidElement(children) ? cloneElement(children as ReactElement<Record<string, unknown>>, {
    'aria-labelledby': labelId,
    ...(children.type === 'div' ? { role: 'group' } : {}),
  }) : children;
  return <div className={`${styles.field} ${wide ? styles.wide : ''}`}><span className={styles.fieldLabel} id={labelId}>{label}{required && <em> *</em>}</span>{control}{hint && <small>{hint}</small>}</div>;
}
function StatusPill({ status }: { status: string }) {
  return <span className={`${styles.statusPill} ${status === 'published' || status === 'active' || status === 'ready' ? styles.statusGood : status === 'failed' || status === 'archived' ? styles.statusBad : styles.statusPending}`}><i />{status}</span>;
}
function VideoTable({ videos, onSelect, compact = false }: { videos: VideoRow[]; onSelect: (id: string) => void; compact?: boolean }) {
  if (!videos.length) return <Empty icon={Clapperboard} title="Nothing here yet" copy="Create your first video draft to get started." />;
  return <div className={styles.tableWrap}><table className={styles.videoTable}><thead><tr><th>VIDEO</th><th>STATUS</th><th>{compact ? 'ADDED' : 'TAGS'}</th><th aria-label="Open" /></tr></thead><tbody>{videos.map(video => <tr key={video._id} onClick={() => onSelect(video._id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onSelect(video._id); }}><td><div className={styles.videoName}><span className={styles.videoThumb}><Play size={15} fill="currentColor" /></span><span><b>{video.title}</b><small>/{video.slug}</small></span></div></td><td><StatusPill status={video.status} /></td><td className={styles.tableMeta}>{compact ? new Date(video.createdAt || Date.now()).toLocaleDateString() : (video.tags || []).slice(0, 3).join(', ') || '—'}</td><td><button className={styles.rowArrow} aria-label={`Open ${video.title}`} onClick={e => { e.stopPropagation(); onSelect(video._id); }}><ArrowRight size={16} /></button></td></tr>)}</tbody></table></div>;
}
function Empty({ icon: Icon, title, copy }: { icon: typeof Film; title: string; copy: string }) {
  return <div className={styles.emptyState}><span><Icon size={21} /></span><b>{title}</b><p>{copy}</p></div>;
}
function VideoDetail({ video, categories, busy, sourceDraft, setSourceDraft, onClose, onAddSource, onSourceStatus, onVideoStatus, onSave }: { video: VideoDetails; categories: Category[]; busy: boolean; sourceDraft: SourceDraft; setSourceDraft: (draft: SourceDraft) => void; onClose: () => void; onAddSource: (event: FormEvent) => void; onSourceStatus: (source: Source, status: string) => void; onVideoStatus: (status: string) => void; onSave: (input: Record<string, unknown>) => void }) {
  const [draft, setDraft] = useState({ title: video.title, description: video.description || '', uploadDate: video.uploadDate ? new Date(video.uploadDate).toISOString().slice(0, 10) : '', thumbnailUrl: video.thumbnail?.url || '', seoTitle: video.seo?.title || '', seoDescription: video.seo?.metaDescription || '', tags: (video.tags || []).join(', '), categories: video.categories || [] });
  useEffect(() => setDraft({ title: video.title, description: video.description || '', uploadDate: video.uploadDate ? new Date(video.uploadDate).toISOString().slice(0, 10) : '', thumbnailUrl: video.thumbnail?.url || '', seoTitle: video.seo?.title || '', seoDescription: video.seo?.metaDescription || '', tags: (video.tags || []).join(', '), categories: video.categories || [] }), [video._id, video.updatedAt]);
  function saveDetails(event: FormEvent) {
    event.preventDefault();
    onSave({ title: draft.title, h1: draft.title, description: draft.description, bodyText: draft.description,
      tags: draft.tags.split(',').map(tag => tag.trim()).filter(Boolean), categories: draft.categories,
      seo: { title: draft.seoTitle, metaDescription: draft.seoDescription },
      ...(draft.uploadDate ? { uploadDate: new Date(`${draft.uploadDate}T12:00:00.000Z`).toISOString() } : {}),
      ...(draft.thumbnailUrl ? { thumbnail: { url: draft.thumbnailUrl, alt: draft.title } } : {}),
    });
  }
  const eligibleCategories = categories.filter(category => category.status === 'active' && category.contentRating === video.contentRating);
  return <div className={styles.detailBackdrop} role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className={styles.detailPanel} role="dialog" aria-modal="true" aria-labelledby="video-detail-title"><header className={styles.detailHeader}><button className={styles.backButton} onClick={onClose}><ArrowLeft size={17} /> Back to videos</button><button className={styles.iconButton} aria-label="Close video details" onClick={onClose}><X size={17} /></button></header>
    <div className={styles.detailBody}><p className={styles.eyebrow}>VIDEO RECORD</p><h2 id="video-detail-title">{video.title}</h2><p className={styles.detailSlug}>/{video.slug}</p><div className={styles.detailStatus}><StatusPill status={video.status} /><span className={`${styles.ratingTag} ${video.contentRating === 'adult' ? styles.adultTag : ''}`}>{video.contentRating || 'unclassified'}</span></div>
      <form className={styles.editVideoForm} onSubmit={saveDetails}><div className={styles.panelHeader}><div><h3>Catalog details</h3><p>Edit metadata and taxonomy</p></div></div><div className={styles.sourceFormGrid}><Field label="Title" required><input required maxLength={300} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></Field><Field label="Original upload date"><input type="date" value={draft.uploadDate} onChange={e => setDraft({ ...draft, uploadDate: e.target.value })} /></Field><Field label="Description" required><textarea required rows={3} maxLength={5000} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></Field><Field label="Thumbnail URL"><input type="url" value={draft.thumbnailUrl} onChange={e => setDraft({ ...draft, thumbnailUrl: e.target.value })} placeholder="https://…" /></Field><Field label="SEO title"><input maxLength={300} value={draft.seoTitle} onChange={e => setDraft({ ...draft, seoTitle: e.target.value })} /></Field><Field label="SEO description"><textarea rows={2} maxLength={1000} value={draft.seoDescription} onChange={e => setDraft({ ...draft, seoDescription: e.target.value })} /></Field><Field label="Tags"><input value={draft.tags} onChange={e => setDraft({ ...draft, tags: e.target.value })} placeholder="tag-one, tag-two" /></Field><Field label="Categories"><div className={styles.categoryChoices}>{eligibleCategories.map(category => <label className={styles.checkChoice} key={category._id}><input type="checkbox" checked={draft.categories.includes(category.slug)} onChange={e => setDraft({ ...draft, categories: e.target.checked ? [...draft.categories, category.slug] : draft.categories.filter(slug => slug !== category.slug) })} /><span>{category.name}</span></label>)}</div></Field></div><button className={styles.secondaryButton} disabled={busy}><BadgeCheck size={15} /> Save details</button></form>
      <section className={styles.sourceSection}><div className={styles.panelHeader}><div><h3>Provider sources</h3><p>Playback mirrors and readiness</p></div><span className={styles.countBubble}>{video.sources.length}</span></div>
        {video.sources.map(source => <article className={styles.sourceCard} key={source._id}><div className={styles.sourceTop}><div><b>{source.provider}</b><small>{source.externalVideoId}</small></div><StatusPill status={source.status} /></div><a href={source.kind === 'embed' ? source.embedUrl : source.contentUrl} target="_blank" rel="noreferrer" className={styles.sourceLink}>{source.kind === 'embed' ? source.embedUrl : source.contentUrl}<ArrowRight size={13} /></a>{source.status !== 'ready' && source.status !== 'removed' && <button className={styles.textButton} disabled={busy} onClick={() => onSourceStatus(source, 'ready')}><BadgeCheck size={15} /> Confirm playable</button>}</article>)}
        <form onSubmit={onAddSource} className={styles.sourceForm}><h4><Plus size={16} /> Add a provider source</h4><div className={styles.sourceFormGrid}><Field label="Provider" required><select value={sourceDraft.provider} onChange={e => setSourceDraft({ ...sourceDraft, provider: e.target.value })}><option value="voe">VOE</option><option value="playmate">Playmate</option><option value="vidara">Vidara</option><option value="lulustream">LuluStream</option></select></Field><Field label="File ID" required><input required value={sourceDraft.externalVideoId} onChange={e => setSourceDraft({ ...sourceDraft, externalVideoId: e.target.value })} placeholder="Provider file code" /></Field><Field label="Embed URL" required><input required type="url" value={sourceDraft.url} onChange={e => setSourceDraft({ ...sourceDraft, url: e.target.value })} placeholder="https://…" /></Field><Field label="Readiness"><select value={sourceDraft.status} onChange={e => setSourceDraft({ ...sourceDraft, status: e.target.value as SourceDraft['status'] })}><option value="processing">Processing / unverified</option><option value="ready">Ready — verified</option></select></Field></div><button className={styles.secondaryButton} disabled={busy}><Plus size={15} /> Save source</button></form>
      </section>
      <div className={styles.publishBar}><div><b>{video.status === 'published' ? 'Live on the site' : 'Keep this record in draft'}</b><small>Publish requires complete metadata and one ready, approved source.</small></div>{video.status === 'published' ? <button className={styles.secondaryButton} disabled={busy} onClick={() => onVideoStatus('archived')}>Archive</button> : <button className={styles.primaryButton} disabled={busy} onClick={() => onVideoStatus('published')}>Publish video <ArrowRight size={15} /></button>}</div>
    </div></section></div>;
}
