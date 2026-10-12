import Image from 'next/image';
import styles from './PlayOrbit.module.css';

// Kept as the shared loader entry point for existing route loading boundaries.
export default function PlayOrbit({ label = 'Loading...', compact = false }: { label?: string; compact?: boolean }) {
  return <div role="status" aria-live="polite" data-brand-loader={compact ? undefined : "fullscreen"} className={`${styles.loader} ${compact ? styles.compact : ''}`}>
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.glow} />
      <Image src="/watermark.png" alt="" width={1672} height={941} sizes={compact ? '220px' : '(max-width: 700px) 85vw, 560px'} priority className={styles.logo} />
      <div className={styles.track}><span className={styles.beam} /></div>
    </div>
    <p className={styles.label}>{label}<span className={styles.dots} aria-hidden="true"><i /><i /><i /></span></p>
  </div>;
}
