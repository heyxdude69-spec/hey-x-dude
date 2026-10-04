import type { Metadata } from 'next';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'KnightWarrior — Discover your next watch',
  description: 'Explore the latest releases, Indian cinema, and the HD collection.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="pt-[80px] max-sm:pt-[64px]"><Navbar />{children}<Footer /></body></html>;
}
