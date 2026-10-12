import Link from 'next/link';
import type { ReactNode } from 'react';

const action = 'inline-flex min-h-11 items-center justify-center rounded-md border border-line px-5 py-3 text-sm font-medium text-white transition-colors hover:border-accent hover:text-accent';
export default function StatusPage({ code, title, description, children }: { code: string; title: string; description: string; children?: ReactNode }) {
  return <main className="page-container flex min-h-[65svh] items-center justify-center py-12 max-sm:py-8">
    <section aria-labelledby="status-heading" className="w-full max-w-xl rounded-lg border border-line bg-card px-6 py-10 text-center max-sm:px-4 max-sm:py-8">
      <p className="mb-3 font-heading text-sm font-bold tracking-widest text-accent">{code}</p>
      <h1 id="status-heading" className="font-heading text-[28px] font-bold leading-tight [overflow-wrap:anywhere] max-sm:text-[24px]">{title}</h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">{description}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3 max-sm:flex-col">
        {children}
        <Link href="/" className={action}>Go to Home</Link>
        <Link href="/categories" className={action}>Browse categories</Link>
      </div>
    </section>
  </main>;
}
