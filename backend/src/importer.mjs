import { createHash } from 'node:crypto';
import { normalizeTags, SLUG_PATTERN, httpsUrl } from './models.mjs';

export function durationToSeconds(value) {
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value || '');
  if (!match) return undefined;
  const seconds = Math.round(Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0));
  return seconds > 0 && seconds <= 86400 ? seconds : undefined;
}
function validDate(value) { return value && Number.isFinite(Date.parse(value)) ? new Date(value) : undefined; }
export function reportToDraft(report) {
  if (!report?.page?.final_url || !report.seo) throw new Error('Expected a seo_extract.py JSON report');
  const original = new URL(report.page.final_url);
  const slug = decodeURIComponent(original.pathname.split('/').filter(Boolean).at(-1) || '');
  if (!SLUG_PATTERN.test(slug) || slug.length > 180) throw new Error('Source URL must have a valid slug');
  const seo = report.seo, meta = seo.all_meta_tags || [];
  const values = key => meta.filter(item => String(item.property || item.name || '').toLowerCase() === key).map(item => item.content).filter(Boolean);
  const micro = property => (seo.microdata || []).find(item => String(item.itemprop || '').split(' ').includes(property) && item.content)?.content;
  const object = report.schema_video_objects?.[0] || {};
  const thumbnail = Array.isArray(object.thumbnailUrl) ? object.thumbnailUrl[0] : object.thumbnailUrl;
  const thumbnailUrl = (typeof thumbnail === 'object' ? thumbnail?.url : thumbnail) || micro('thumbnailUrl') || values('og:image')[0];
  const title = seo.headings?.h1?.[0] || seo.title;
  if (!title) throw new Error('Report has no usable page title/H1');
  const rating = values('rating').some(value => value === 'adult' || value.startsWith('RTA-')) || object.isFamilyFriendly === false ? 'adult' : 'unknown';
  const video = {
    slug, title: title.slice(0, 300), h1: title.slice(0, 300),
    description: (seo.meta_description?.[0] || micro('description') || object.description || '').slice(0, 5000),
    // Fetched body previews include navigation and recommendations; don't publish them as main content.
    bodyText: '', language: seo.language || 'en',
    seo: { title: (seo.title || title).slice(0, 300), metaDescription: (seo.meta_description?.[0] || '').slice(0, 1000), indexAllowed: true },
    thumbnail: thumbnailUrl && httpsUrl(thumbnailUrl) ? { url: thumbnailUrl, alt: '' } : {},
    tags: normalizeTags(values('article:tag')).slice(0, 32), categories: normalizeTags(values('article:section')).slice(0, 12),
    uploadDate: validDate(object.uploadDate || micro('uploadDate')),
    durationSeconds: durationToSeconds(object.duration || micro('duration')),
    contentRating: rating, status: 'draft', importReference: original.href,
  };
  const locations = [
    ...[object.contentUrl, micro('contentUrl'), ...(report.video_src_urls || [])].flat().filter(Boolean).map(url => ({ kind: 'direct', url })),
    ...[object.embedUrl, micro('embedUrl'), ...(report.iframes || []).map(item => item.src || item.data_src)].flat().filter(Boolean).map(url => ({ kind: 'embed', url })),
  ];
  const sources = [...new Map(locations.filter(item => typeof item.url === 'string' && httpsUrl(item.url)).map(item => [item.url, item])).values()].slice(0, 20).map((item, slot) => ({
    provider: 'reference', externalVideoId: createHash('sha256').update(item.url).digest('hex'), slot,
    kind: item.kind, ...(item.kind === 'direct' ? { contentUrl: item.url } : { embedUrl: item.url }),
    priority: (slot + 1) * 10, enabled: false, status: 'pending', availability: 'unknown',
  }));
  const excluded = new Set(['about-us', 'contact-us', 'content-complaint', 'privacy-policy', 'terms', 'terms-of-service', 'categories', 'tags', 'search', 'login', 'register']);
  const candidates = [];
  for (const link of report.links || []) {
    try {
      const url = new URL(link.href);
      const segments = url.pathname.split('/').filter(Boolean);
      if (url.origin !== original.origin || url.search || segments.length !== 1 || excluded.has(segments[0]) || !SLUG_PATTERN.test(segments[0]) || segments[0] === slug) continue;
      url.hash = '';
      candidates.push(url.href);
    } catch {}
  }
  return { video, sources,
    linkCandidates: [...new Set(candidates)].map(url => ({ url, status: 'requires_fetch', tags: null, title: null })),
    reviewRequired: ['Verify provider URLs, video metadata and classification before publishing.',
      'Flattened microdata has no DOM scope; verify extracted values against the main video.',
      'Linked pages need their own fetch before their metadata or recommendation tags are known.'],
  };
}
