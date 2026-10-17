import type { Metadata } from 'next';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import { getNavigationCategories, type NavigationCategory } from '@/lib/navigation-api';
import { siteOrigin } from '@/lib/video-api';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { DM_Sans, Manrope } from 'next/font/google';
import './globals.css';

const sans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-dm-sans' });
const heading = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], display: 'swap', variable: '--font-manrope' });

// Render per request without disabling the public catalog Data Cache.
async function Navigation({ categories }: { categories: Promise<NavigationCategory[]> }) {
  return <Navbar categories={await categories} />;
}
async function SiteFooter({ categories }: { categories: Promise<NavigationCategory[]> }) {
  return <Footer categories={await categories} />;
}

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: 'HeyxDude | Discover your next watch',
  description: 'Discover videos and collections on HeyxDude.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  },
  openGraph: { siteName: 'HeyxDude', locale: 'en_US', type: 'website' },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  // Start once and share between both streamed boundaries; page content does not wait for navigation.
  const categories = getNavigationCategories().catch((): NavigationCategory[] => []);
  return <html lang="en"><body className={`${sans.variable} ${heading.variable} pt-[80px] max-sm:pt-[64px]`}>
    <Suspense fallback={<Navbar categories={[]} />}><Navigation categories={categories} /></Suspense>
    {children}
    <Suspense fallback={<footer className="min-h-48 border-t border-line bg-[#130d20]" aria-label="Loading footer" />}><SiteFooter categories={categories} /></Suspense>
  </body></html>;
}
