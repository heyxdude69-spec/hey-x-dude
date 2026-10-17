import { thumbnailHosts } from './src/lib/thumbnail-policy.mjs';
const hosts = thumbnailHosts(process.env.NEXT_PUBLIC_THUMBNAIL_HOSTS);
/** @type {import('next').NextConfig} */
const config = {
  env: { NEXT_PUBLIC_THUMBNAIL_HOSTS: hosts.join(',') },
  images: {
    remotePatterns: hosts.map(hostname => ({ protocol: 'https', hostname, port: '', pathname: '/**' })),
    formats: ['image/webp'], minimumCacheTTL: 3600,
    deviceSizes: [360, 640, 750, 1080, 1280, 1920], imageSizes: [64, 96, 128, 256],
  },
};
export default config;
