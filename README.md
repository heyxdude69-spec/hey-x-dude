# KnightWarrior

Next.js App Router application with request-time server rendering, reusable navbar and footer, category filtering, and an accessible search drawer with local suggestions.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. Production: `npm run build` then `npm start`.

The default landing page includes 4 Latest, 4 Indian, and 22 HD cards. Edit `lib/catalog.ts` to change the demo catalog. Artwork is a styled placeholder; replace it with licensed thumbnails when available. Search runs locally across titles, genres, and categories. Category links are rendered on the server. `app/page.tsx` uses `force-dynamic` for SSR on every request.
