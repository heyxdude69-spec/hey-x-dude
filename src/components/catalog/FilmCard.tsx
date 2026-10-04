import { Eye, Image as ImageIcon, Play, ThumbsUp } from 'lucide-react';
import { artTones, type Film } from '@/lib/catalog';

export default function FilmCard({ film }: { film: Film }) {
  return (
    <article id={`film-${film.id}`} tabIndex={0} className="scroll-mt-[25px] overflow-hidden border border-[#7b539225] bg-card transition-[transform,border-color] duration-200 hover:-translate-y-1 hover:border-[#9c71bf66] target:outline-2 target:outline-offset-4 target:outline-[#ad83d4] [container-type:inline-size]">
      <div className={`relative grid aspect-video place-items-center overflow-hidden ${artTones[film.tone]}`}>
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(#ffffff05_1px,transparent_1px)] opacity-25" />
        <span aria-hidden="true" className="absolute -top-[115px] -left-[50px] size-[220px] -rotate-[25deg] rounded-full border border-white/3" />
        <span aria-hidden="true" className="absolute -right-[75px] -bottom-[140px] size-[280px] -rotate-[25deg] rounded-full border border-white/3" />
        <ImageIcon size={60} strokeWidth={1} className="text-[#b69acc] opacity-52 size-[clamp(30px,20cqi,48px)]" />
        <span className="absolute bottom-3 left-3 rounded-[3px] border border-[#d5bde925] bg-[#24123830] px-1.5 py-[3px] text-[8px] tracking-[0.5px] text-[#d5bde9a0] max-md:bottom-[6%] max-md:left-[6%] max-md:px-1 max-md:py-0.5 max-md:text-[clamp(6px,3cqi,8px)] max-sm:px-[5px] max-sm:py-[3px] max-sm:text-[clamp(7px,3.5cqi,9px)]">{film.genre}</span>
        <span className="absolute right-3 bottom-3 grid size-[26px] place-items-center rounded-[3px] border border-white/9 bg-white/4 text-[#dfc9f1] max-md:right-[6%] max-md:bottom-[6%] max-md:size-[clamp(18px,9cqi,24px)] max-sm:size-[clamp(20px,10cqi,26px)]">
          <Play size={15} fill="currentColor" className="max-md:size-[55%]" />
        </span>
      </div>
      <div className="p-[clamp(6px,4cqi,10px)] max-sm:p-2">
        <h3 className="mb-[clamp(4px,2cqi,6px)] min-h-[1.5em] text-center font-heading text-[clamp(10px,5cqi,13px)] leading-[1.5] font-bold tracking-[-0.2px] [overflow-wrap:anywhere] max-sm:mb-1 max-sm:min-h-0 max-sm:text-[clamp(12px,6cqi,14px)]">{film.title}</h3>
        <div className="flex items-center justify-center gap-[clamp(5px,3cqi,9px)] text-[clamp(9px,4cqi,11px)] text-[#b1a0c2] max-sm:gap-[clamp(7px,4cqi,10px)] max-sm:text-[clamp(10px,4.5cqi,12px)] [&>span]:flex [&>span]:items-center [&>span]:gap-[clamp(3px,2cqi,6px)] max-sm:[&>span]:gap-1 [&_svg]:shrink-0 [&_svg]:size-[clamp(11px,5cqi,15px)] max-sm:[&_svg]:size-[clamp(13px,6cqi,16px)]">
          <span><Eye size={16} />{film.views}</span>
          <span className="text-[#dfd1ed]"><ThumbsUp size={15} />{film.rating}%</span>
          <span className="rounded-[3px] border border-[#75654e30] bg-[#39342c] px-[5px] py-[3px] text-[10px] font-extrabold tracking-[0.3px] text-[#efe7d3] max-md:px-1 max-md:py-0.5 max-md:text-[clamp(8px,3.5cqi,10px)] max-sm:px-[5px] max-sm:py-[3px] max-sm:text-[clamp(9px,4cqi,11px)]">HD</span>
        </div>
      </div>
    </article>
  );
}
