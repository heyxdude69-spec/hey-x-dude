// Stable pseudo-random decoration; recommendation ranking is unchanged.
function score(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}
export function recommendationBadges(ids: string[], seed: string): Set<string> {
  const visible = [...new Set(ids)].slice(0, 16);
  const select = (batch: string[], count: number) => batch.map(id => ({ id, rank: score(`${seed}:${id}`) }))
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id)).slice(0, count).map(row => row.id);
  return new Set([...select(visible.slice(0, 8), 2), ...select(visible.slice(8, 16), 1)]);
}
