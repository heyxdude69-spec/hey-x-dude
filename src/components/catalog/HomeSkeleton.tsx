import styles from './HomeSkeleton.module.css';

export default function HomeSkeleton() {
  return <main className="page-container pt-1.5 max-sm:pt-0" aria-busy="true">
    <p role="status" className="sr-only">Loading videos...</p>
    <div aria-hidden="true">{[0, 1, 2].map(section => <section key={section} className="border-b border-line py-5 last:border-b-0 max-sm:py-3">
      <div className="mb-3 flex items-center justify-between gap-4 max-sm:mb-2"><div className={`${styles.shimmer} h-7 w-40 max-w-[55%] rounded`} /><div className={`${styles.shimmer} h-3 w-16 rounded`} /></div>
      <div className="grid grid-cols-5 gap-3.5 max-md:grid-cols-4 max-md:gap-2.5 max-sm:grid-cols-2 max-sm:gap-1.5">
        {Array.from({ length: 10 }, (_, index) => <div key={index} className="overflow-hidden border border-[#7b539225] bg-card">
          <div className={`${styles.shimmer} relative aspect-video`}><span className="absolute bottom-2 right-2 h-3 w-7 rounded bg-black/20 max-sm:bottom-1 max-sm:right-1" /></div>
          <div className="px-3 py-2.5 max-sm:p-2"><div className={`${styles.shimmer} mx-auto h-4 w-4/5 rounded`} /></div>
        </div>)}
      </div>
    </section>)}</div>
  </main>;
}
