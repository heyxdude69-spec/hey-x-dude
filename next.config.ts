import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

export default function nextConfig(phase: string) {
  return {
    // Keep a running dev server from overwriting production build artifacts.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next' : '.next-production',
  };
}
