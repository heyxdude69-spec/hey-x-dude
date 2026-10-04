import Image from 'next/image';
import Link from 'next/link';

export default function Brand({ priority = false, large = false }: { priority?: boolean; large?: boolean }) {
  return (
    <Link href="/" className="inline-flex shrink-0">
      <Image
        src="/logo.png"
        alt="heyXdude home"
        width={large ? 210 : 150}
        height={large ? 140 : 100}
        className={large
          ? 'block h-[140px] w-[210px] object-contain max-sm:h-[110px] max-sm:w-[165px]'
          : 'block h-[100px] w-[150px] object-contain max-sm:h-20 max-sm:w-[120px]'}
        priority={priority}
      />
    </Link>
  );
}
