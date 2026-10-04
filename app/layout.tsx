import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import './globals.css';

export const metadata: Metadata = { title: 'KnightWarrior — Discover your next watch', description: 'Explore the latest releases, Indian cinema, and the HD collection.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Navbar />{children}<Footer /></body></html>;
}
