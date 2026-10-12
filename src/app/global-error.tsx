'use client';

// Root-layout errors replace the entire document, so this fallback has its own styles.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><head><title>Temporarily unavailable | KnightWarrior</title><meta name="robots" content="noindex, follow" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>{`
    * { box-sizing: border-box; }
    body { margin: 0; background: #100b1b; color: #f4f0fb; font-family: Arial, sans-serif; }
    main { min-height: 100vh; min-height: 100svh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; }
    section { width: 100%; max-width: 560px; border: 1px solid #ffffff12; border-radius: 8px; background: #211333; padding: 32px 24px; text-align: center; }
    h1 { font-size: clamp(24px, 5vw, 28px); line-height: 1.25; overflow-wrap: anywhere; }
    p { color: #b1a0c2; font-size: 14px; line-height: 1.7; }
    nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 28px; }
    button, a { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 12px 20px; border: 1px solid #ffffff33; border-radius: 6px; background: transparent; color: #f4f0fb; font: inherit; font-size: 14px; text-decoration: none; cursor: pointer; }
    button { background: #ed145b; border-color: #ed145b; }
    button:focus-visible, a:focus-visible { outline: 2px solid #ed145b; outline-offset: 4px; }
    @media (max-width: 480px) { nav { flex-direction: column; } section { padding: 28px 16px; } }
  `}</style></head><body><main><section aria-labelledby="global-error-heading"><h1 id="global-error-heading">Temporarily unavailable</h1><p>We could not load the site. Please try again in a moment.</p><nav aria-label="Recovery options"><button onClick={reset}>Try again</button><a href="/">Go to Home</a><a href="/categories">Browse categories</a></nav></section></main></body></html>;
}
