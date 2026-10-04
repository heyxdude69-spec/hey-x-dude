import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

export default function nextConfig(phase: string) {
  return {
    // Keep a running dev server from overwriting production build artifacts.
    distDir: process.env.VERCEL || phase === PHASE_DEVELOPMENT_SERVER ? '.next' : '.next-production',
  };
}
