'use client';

import StatusPage from '@/components/layout/StatusPage';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <StatusPage code="PLEASE TRY AGAIN" title="Something went wrong" description="We could not load this page. Try again, or return home to continue browsing.">
    <button onClick={reset} className="inline-flex min-h-11 items-center justify-center rounded-md border border-accent bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/80">Try again</button>
  </StatusPage>;
}
