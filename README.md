# KnightWarrior

Next.js App Router application with request-time server rendering, Tailwind CSS v4, category filtering, and an accessible search drawer with local suggestions.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. Production: `npm run build` then `npm start`.

## Structure

```text
src/
  app/                    # Routes, root layout, Tailwind theme and base styles
  components/
    layout/               # Shared Brand, Navbar and Footer
    catalog/              # Catalog, FilmCard and Pagination
  data/                   # Demo catalog and category definitions
  lib/                    # Shared pagination logic
tests/                    # Catalog and pagination checks
public/                   # Logo and static image assets
postcss.config.mjs         # Tailwind v4 PostCSS integration
```

The landing page includes 5 Latest, 5 Indian, 5 Recommendations, and 25 HD cards. Edit `src/data/catalog.ts` to change the demo catalog. Artwork is a styled placeholder; replace it with licensed thumbnails when available. Search runs locally across titles, genres, and categories. `src/app/page.tsx` uses `force-dynamic` for SSR on every request.

All component styling uses Tailwind utilities. `src/app/globals.css` contains the Tailwind import, theme, accessibility defaults, and one shared page-container utility. Breakpoints preserve the existing design: `sm` 700px, `md` 1000px, and `xl` 1450px. Change the logo once in `src/components/layout/Brand.tsx` to update both the navbar and footer.

Next.js uses its default `.next` build directory locally and on Vercel. Stop the development server before running a production build in the same folder.

The HD collection uses server-rendered pagination with 25 cards per page. Previous/Next become available as more HD titles are added. The navbar has a centered logo, a left menu, and right navigation/search controls.

The categories index is available at `/categories`. See more opens `/categories/latest`, `/categories/indian`, `/categories/recommendations`, or `/categories/hd`. Below 1000px, the last card in each landing-page section is hidden; category pages show every card on the current page. Pagination displays at most six numbered links. Run `npm test` for the pagination-window check.

## Video embeds (dummy data)

Video pages use `/video/[slug]`. Each video has four `servers` (VOE, Vidara, Lulustream, Stream). Set each server's `embedUrl` to the `src` URL from that provider's iframe code. Fullscreen, volume, seeking and speed controls belong to the embedded provider; the app supplies the responsive frame, loading state, retry and unavailable state. Raw embed HTML is not executed.

The default iframe `/demo/player.html` plays a generated 12-second sample (not the catalog's fictional duration). Every tenth item demonstrates all servers failing; the preceding item demonstrates Server 1 failing and automatic fallback to Server 2. The sample has native controls without an app speed selector. Replace the demo URL with the actual provider URL when connecting real data.

Cross-origin iframe load events cannot verify provider playback or detect every provider error. Detected frame/media errors and the 20-second load timeout advance to the next server; after Server 4 fails, Retry servers starts again at Server 1. Manual switching and Reload player remain available for errors inside a provider's UI. The local demo reports media errors and playback position to the parent frame. Demo server changes resume playback; real providers need their own player APIs for error detection, time tracking and seeking. Generic cross-origin iframe URLs cannot guarantee automatic playback detection or timestamp continuity.

Downloads only appear when `downloadEnabled` is true and `downloadUrl` exists. They use the download URL, never the iframe URL. Sample downloads use `/demo/sample.mp4`. Providers must supply an allowed download link for real videos.

Tags open `/tag/[slug]` and filter the same dummy catalog. About is collapsed by default; categories and tags remain visible. Likes/comments are local demo UI without a backend.
