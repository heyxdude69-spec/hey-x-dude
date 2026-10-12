import type { Metadata } from 'next';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import { getNavigationCategories, type NavigationCategory } from '@/lib/navigation-api';
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
  title: 'KnightWarrior — Discover your next watch',
  description: 'Explore the latest releases, Indian cinema, and the HD collection.',
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
