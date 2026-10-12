import type { Metadata } from 'next';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import { getNavigationCategories, type NavigationCategory } from '@/lib/navigation-api';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'KnightWarrior — Discover your next watch',
  description: 'Explore the latest releases, Indian cinema, and the HD collection.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let categories: NavigationCategory[] = [];
  try { categories = await getNavigationCategories(); }
  catch (error) { console.error('Navigation API failed:', error instanceof Error ? error.message : 'Unknown error'); }
  return <html lang="en"><body className="pt-[80px] max-sm:pt-[64px]"><Navbar categories={categories} />{children}<Footer categories={categories} /></body></html>;
}
