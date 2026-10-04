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
    catalog/              # FilmCard
  lib/                    # Catalog data and category definitions
public/                   # Logo and static image assets
postcss.config.mjs         # Tailwind v4 PostCSS integration
next.config.ts            # Separate dev and production build directories
```

The landing page includes 5 Latest, 5 Indian, 5 Recommendations, and 25 HD cards. Edit `src/lib/catalog.ts` to change the demo catalog. Artwork is a styled placeholder; replace it with licensed thumbnails when available. Search runs locally across titles, genres, and categories. `src/app/page.tsx` uses `force-dynamic` for SSR on every request.

All component styling uses Tailwind utilities. `src/app/globals.css` contains the Tailwind import, theme, accessibility defaults, and one shared page-container utility. Breakpoints preserve the existing design: `sm` 700px, `md` 1000px, and `xl` 1450px. Change the logo once in `src/components/layout/Brand.tsx` to update both the navbar and footer.

Restart the dev server after migration. Development uses `.next`; production build/start use `.next-production` so they can run without overwriting each other's artifacts.

The HD collection uses server-rendered pagination with 25 cards per page. Previous/Next become available as more HD titles are added. The navbar has a centered logo, a left menu, and right navigation/search controls.

See more opens `/category/latest`, `/category/indian`, `/category/recommendations`, or `/category/hd`. Below 1000px, the last card in each landing-page section is hidden; category pages show every card on the current page. Pagination displays at most six numbered links. Run `npm test` for the pagination-window check.
