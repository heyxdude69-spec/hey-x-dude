'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { thumbnailHosts, optimizableThumbnail } from '@/lib/thumbnail-policy.mjs';
const approvedHosts = thumbnailHosts(process.env.NEXT_PUBLIC_THUMBNAIL_HOSTS);

export default function CategoryPoster({ url, fallbackUrls = [], alt, priority = false, sizes = '(max-width: 1000px) 50vw, 350px' }: { url?: string; fallbackUrls?: string[]; alt: string; sizes?: string; priority?: boolean }) {
  const sources = [...new Set([url, ...fallbackUrls].filter((value): value is string => !!value))];
  const sourceKey = sources.join('\n');
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failedOptimization, setFailedOptimization] = useState<string | null>(null);
  useEffect(() => { setSourceIndex(0); setFailedOptimization(null); }, [sourceKey]);
  const candidate = sources[sourceIndex];
  const src = candidate || '/thumbnails/scene-1.svg';
  const optimize = optimizableThumbnail(src, approvedHosts) && failedOptimization !== src;
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority}
    className="object-cover" quality={75} unoptimized={!optimize} onError={() => {
      if (!candidate) return;
      if (optimize) setFailedOptimization(src);
      else setSourceIndex(index => index + 1);
    }} />;
}
