(() => {
  const dataElement = document.getElementById('player-data');
  if (!dataElement) return;
  const data = JSON.parse(dataElement.textContent), area = document.getElementById('player-area');
  const message = document.getElementById('playback-message');
  function watchErrors(player) {
    // Cross-origin iframe load does not establish playback success. Manual switching remains visible.
    if (player.tagName === 'VIDEO') player.addEventListener('error', () => {
      message.textContent = 'This source could not play. Choose another source.';
    });
  }
  watchErrors(document.getElementById('video-player') || area);
  for (const button of document.querySelectorAll('[data-source-id]')) button.addEventListener('click', () => {
    const source = data.sources.find(item => item.id === button.dataset.sourceId);
    if (!source) return;
    const old = document.getElementById('video-player');
    if (old?.tagName === 'VIDEO') old.pause();
    const player = document.createElement(source.kind === 'embed' ? 'iframe' : 'video');
    player.id = 'video-player';
    if (source.kind === 'embed') {
      player.title = data.title; player.allow = 'fullscreen; picture-in-picture';
      player.allowFullscreen = true; player.referrerPolicy = 'strict-origin-when-cross-origin';
    } else { player.controls = true; player.preload = 'metadata'; if (data.poster) player.poster = data.poster; }
    player.src = source.url;
    area.replaceChildren(player); watchErrors(player);
    for (const item of document.querySelectorAll('[data-source-id]')) item.setAttribute('aria-pressed', String(item === button));
    message.textContent = `Selected ${source.provider}. Playback problem? Choose another source.`;
    // The selection is local to this page session; no global source status or priority is changed.
  });
})();
