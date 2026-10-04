import { Eye, ThumbsUp, Play, Image as ImageIcon } from 'lucide-react';
import type { Film } from '@/lib/catalog';

export default function FilmCard({ film }: { film: Film }) {
  return <article id={`film-${film.id}`} className="film-card" tabIndex={0}>
    <div className={`card-art tone-${film.tone}`}><div className="art-grid" /><span className="art-orbit orbit-one" /><span className="art-orbit orbit-two" /><ImageIcon className="art-image" size={60} strokeWidth={1} /><span className="card-genre">{film.genre}</span><span className="play-badge"><Play size={15} fill="currentColor" /></span></div>
    <div className="card-body"><h3>{film.title}</h3><div className="card-stats"><span><Eye size={16} />{film.views}</span><span><ThumbsUp size={15} />{film.rating}%</span><span className="hd-badge">HD</span></div></div>
  </article>;
}
