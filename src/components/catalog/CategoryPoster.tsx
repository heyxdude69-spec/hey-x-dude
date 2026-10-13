'use client';

import Image from 'next/image';
import { useState } from 'react';
import { thumbnailHosts, optimizableThumbnail } from '@/lib/thumbnail-policy.mjs';
const approvedHosts = thumbnailHosts(process.env.NEXT_PUBLIC_THUMBNAIL_HOSTS);

export default function CategoryPoster({ url, alt, priority = false, sizes = '(max-width: 1000px) 50vw, 350px' }: { url?: string; alt: string; sizes?: string; priority?: boolean }) {
  const [failedOptimization, setFailedOptimization] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const src = url && failedUrl !== url ? url : '/thumbnails/scene-1.svg';
  const optimize = optimizableThumbnail(src, approvedHosts) && failedOptimization !== src;
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority}
    className="object-cover" quality={75} unoptimized={!optimize} onError={() => { if (optimize) setFailedOptimization(src); else if (url) setFailedUrl(url); }} />;
}
