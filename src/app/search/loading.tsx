import PlayOrbit from '@/components/ui/PlayOrbit';
export default function Loading() {
  return <main className="page-container py-6 max-sm:py-4" aria-busy="true"><PlayOrbit compact label="Loading search results..." /><div aria-hidden="true" className="motion-safe:animate-pulse"><div className="mb-5 h-8 w-32 rounded bg-white/5" /><div className="mb-5 h-11 rounded bg-white/5" /><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5 lg:gap-3.5">{Array.from({ length: 10 }, (_, index) => <div key={index} className="border border-line bg-card"><div className="aspect-video bg-white/5" /><div className="m-3 h-4 rounded bg-white/5" /></div>)}</div></div></main>;
}
