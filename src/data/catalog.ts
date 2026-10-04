export const categories = ['Latest', 'Indian', 'Recommendations', 'HD'] as const;
export const tagSlug = (tag: string) => tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export type VideoServer = { provider: string; embedUrl: string };
export type Film = {
  id: number;
  slug: string;
  title: string;
  thumbnail: string;
  duration: number;
  movie: string;
  language: string;
  quality: 'SD' | 'HD' | '4K';
  category: typeof categories[number];
  categories: string[];
  views: string;
  rating: number;
  genre: string;
  servers: VideoServer[];
  uploadedAt: string;
  downloadEnabled: boolean;
  downloadUrl?: string;
  description: string;
  tags: string[];
};
const latest = ['Beyond the Horizon', 'The Midnight Passenger', 'Echoes of Tomorrow', 'Into the Wild', 'A New Beginning'];
const indian = ['City of Dreams', 'The Last Monsoon', 'A Thousand Stories', 'Under the Same Sky', 'The River Within'];
const recommendations = ['Open Roads', 'The Hidden Garden', 'Starlight Stories', 'Far from Home', 'The Quiet Hours'];
const hd = ['The Silent Ocean', 'Northern Lights', 'A Place to Begin', 'Chasing the Sun', 'After the Rain', 'The Long Way Home', 'Golden Hour', 'Lost in the City', 'The Mountain Between', 'A Different World', 'Moonlit Roads', 'The Art of Living', 'Wild at Heart', 'The Forgotten Valley', 'Summer in September', 'Where We Belong', 'The Blue Frontier', 'Days of Wonder', 'A Beautiful Escape', 'The Other Side', 'Letters to Tomorrow', 'One More Adventure', 'The Last Lighthouse', 'Morning in the Valley', 'Across the Desert'];
const genres = ['Adventure', 'Thriller', 'Sci-fi', 'Drama'];
const movies = ['Beyond the Horizon', 'City of Dreams', 'The Silent Ocean', 'Northern Lights'];

export const films: Film[] = [
  ...latest.map(title => ({ title, category: 'Latest' as const })),
  ...indian.map(title => ({ title, category: 'Indian' as const })),
  ...recommendations.map(title => ({ title, category: 'Recommendations' as const })),
  ...hd.map(title => ({ title, category: 'HD' as const })),
].map((film, i) => {
  const genre = genres[i % genres.length];
  const movie = movies[i % movies.length];
  const language = film.category === 'Indian' ? 'Hindi' : ['English', 'Hindi', 'Tamil', 'Telugu'][i % 4];
  const quality = film.category === 'HD' ? 'HD' : (['HD', '4K', 'SD'] as const)[i % 3];
  return {
    ...film,
    id: i + 1,
    slug: film.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    thumbnail: `/thumbnails/scene-${i % 4 + 1}.svg`,
    duration: [120, 315, 950, 7200, 5430][i % 5],
    movie,
    language,
    quality,
    categories: [film.category],
    servers: ['VOE', 'Vidara', 'Lulustream', 'Stream'].map((provider, server) => ({
      provider,
      embedUrl: `/demo/player.html?server=${server + 1}${i % 10 === 9 || (i % 10 === 8 && server === 0) ? '&error=1' : ''}`,
    })),
    uploadedAt: new Date(Date.UTC(2026, 8, 30 - i)).toISOString(),
    downloadEnabled: i % 3 === 0,
    downloadUrl: i % 3 === 0 ? '/demo/sample.mp4' : undefined,
    views: `${(2.3 + i * .37).toFixed(1)}k`,
    rating: 96 + i % 5,
    genre,
    description: `Discover ${film.title} from ${movie}. This ${language} ${genre.toLowerCase()} video is part of our ${film.category} collection.`,
    tags: [genre, language, quality],
  };
});
