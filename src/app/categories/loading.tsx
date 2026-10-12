import PlayOrbit from '@/components/ui/PlayOrbit';
export default function CategoriesLoading() {
  return <main className="page-container py-7 max-sm:py-4" aria-busy="true">
    <PlayOrbit compact label="Loading categories..." />
    <div aria-hidden="true" className="motion-safe:animate-pulse">
      <div className="mb-3 h-8 w-40 rounded bg-card" />
      <div className="mb-6 h-4 w-3/4 max-w-80 rounded bg-card" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 8 }, (_, index) => <div key={index} className="min-w-0 overflow-hidden border border-line bg-card">
          <div className="aspect-video bg-white/5" />
          <div className="space-y-2 p-4 max-sm:p-2.5"><div className="h-10 rounded bg-white/5" /><div className="h-4 w-16 rounded bg-white/5" /></div>
        </div>)}
      </div>
    </div>
  </main>;
}
