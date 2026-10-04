import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
export default function Footer() {
  return <footer className="footer"><div className="container footer-main"><div><Link href="/" className="brand"><Image src="/logo.png" alt="heyXdude home" width={120} height={80} className="brand-logo" /></Link><p>A world of stories. A place to discover them.</p></div><div className="footer-links"><Link href="/">Home<ArrowUpRight size={14} /></Link><Link href="/#categories">Categories<ArrowUpRight size={14} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} KnightWarrior. All rights reserved.</span><span>Made for the love of cinema.</span></div></footer>;
}
