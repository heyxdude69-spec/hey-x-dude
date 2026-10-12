'use client';

import { useRef, type PointerEvent } from 'react';
import styles from './PlayOrbit.module.css';

export default function PlayOrbit({ label = 'Loading...', compact = false }: { label?: string; compact?: boolean }) {
  const scene = useRef<HTMLDivElement>(null);
  function reset() {
    scene.current?.style.setProperty('--tilt-x', '0deg');
    scene.current?.style.setProperty('--tilt-y', '0deg');
  }
  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || !window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    scene.current?.style.setProperty('--tilt-x', `${-(event.clientY - bounds.top - bounds.height / 2) / bounds.height * 16}deg`);
    scene.current?.style.setProperty('--tilt-y', `${(event.clientX - bounds.left - bounds.width / 2) / bounds.width * 16}deg`);
  }
  return <div role="status" aria-live="polite" className={`${styles.loader} ${compact ? styles.compact : ''}`}>
    <div className={styles.interaction} onPointerMove={tilt} onPointerLeave={reset} onPointerCancel={reset} aria-hidden="true">
      <div ref={scene} className={styles.scene}>
        <div className={styles.halo} />
        <div className={styles.outer}><span className={styles.dot} /></div>
        <div className={styles.inner} />
        <div className={styles.core}><svg viewBox="0 0 32 32" width="30" height="30" fill="currentColor"><path d="M11 7.5a1.5 1.5 0 0 1 2.3-1.27l13 8.5a1.5 1.5 0 0 1 0 2.54l-13 8.5A1.5 1.5 0 0 1 11 24.5z" /></svg></div>
      </div>
    </div>
    <p className={styles.label}>{label}</p>
  </div>;
}
