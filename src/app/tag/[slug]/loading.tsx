import PlayOrbit from '@/components/ui/PlayOrbit';
export default function TagLoading() {
  return <main className="page-container py-6 max-sm:py-4" aria-busy="true">
    <PlayOrbit compact label="Loading tagged videos..." />
    <div aria-hidden="true" className="motion-safe:animate-pulse">
      <div className="mb-3 h-6 w-48 max-w-full rounded bg-card" />
      <div className="mb-2 h-8 w-60 max-w-full rounded bg-card" />
      <div className="mb-5 h-4 w-20 rounded bg-card" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5 lg:gap-3.5">
        {Array.from({ length: 10 }, (_, index) => <div key={index} className="min-w-0 overflow-hidden border border-line bg-card">
          <div className="aspect-video bg-white/5" /><div className="p-2"><div className="h-5 rounded bg-white/5" /></div>
        </div>)}
      </div>
    </div>
  </main>;
}
