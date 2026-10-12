'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function CategoryPoster({ url, alt, priority = false, sizes = '(max-width: 1000px) 50vw, 350px' }: { url?: string; alt: string; sizes?: string; priority?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const src = url && failedUrl !== url ? url : '/thumbnails/scene-1.svg';
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority}
    className="object-cover" unoptimized onError={() => { if (url) setFailedUrl(url); }} />;
}
