/** @param {string | undefined} raw */
export function thumbnailHosts(raw) {
  return [...new Set((raw || '').split(',').map(value => value.trim().toLowerCase()).filter(host =>
    host.length <= 253 && /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) &&
    !host.endsWith('.localhost') && !host.endsWith('.local') && !host.endsWith('.internal')
  ))].slice(0, 30);
}
/** @param {string} src @param {string[]} hosts */
export function optimizableThumbnail(src, hosts) {
  if (src.startsWith('/') && !src.startsWith('//')) return !src.split('?')[0].toLowerCase().endsWith('.svg');
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') && hosts.includes(url.hostname) && !url.pathname.toLowerCase().endsWith('.svg');
  } catch { return false; }
}
