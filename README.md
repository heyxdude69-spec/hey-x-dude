# KnightWarrior

Next.js frontend and Express/MongoDB backend in one repository. Home, category directory, category videos, root video pages, tags, Navbar/Footer navigation and Navbar search read real backend data. Existing layouts are preserved.

## Repository

- `src/`: Next.js routes, components and server-side API adapters.
- `backend/src/`: Express API, MongoDB schemas, Redis cache, SEO, search, homepage feeds and interactions.
- `backend/scripts/`: database/index setup and sitemap jobs.
- `tests/` and `backend/tests/`: frontend mapping and backend checks.

Private upload/category-management/moderation CLIs in `adminhandlers` are intentionally excluded. Downloads, media-processing tools, scraped reports, runtime data, private environment files and generated Next.js builds are also excluded.

## Start locally

Requires Node.js 22.14+ and a MongoDB replica set such as Atlas for transactional views, voting and comment submissions.

1. In `backend/`, run `npm ci` and copy `.env.example` to `.env`.
2. Set `MONGODB_URI`, a strong `ADMIN_API_TOKEN`, `PUBLIC_SITE_URL=http://localhost:3001` and `INTERACTION_PROXY_SECRET` (at least 32 characters).
3. Run `npm run db:setup` to create collections, validators and indexes without importing private catalog data.
4. Run `npm start` in `backend/`; the backend uses port 3000.
5. In the repository root, run `npm ci` and copy `.env.example` to `.env.local`.
6. Set the same server-only `INTERACTION_PROXY_SECRET`, `CATALOG_API_ORIGIN=http://127.0.0.1:3000`, `SITE_URL=http://localhost:3001` and the catalog's `CATALOG_CONTENT_RATING`.
7. Run `npm run dev -- --port 3001`.

Never expose MongoDB credentials, provider keys or the proxy secret through `NEXT_PUBLIC_` environment variables. Never commit real `.env` files.

Existing catalog and `homepage_settings` data remain in Atlas. Database setup creates schema/index infrastructure; it does not seed homepage sections or publish videos. Use the private local admin tools to maintain that data and approve pending comments.

## Connected behavior

- Category thumbnails use the latest published video's poster; missing/broken images use the local placeholder.
- Category and tag listings show 25 videos per numbered page. Tag queries use the existing tag index; content ratings stay isolated.
- Video pages live at `/{slug}`; `/video/{slug}` permanently redirects.
- Recommendations show 8 videos, then 8 more, then an Explore more category link.
- Views/votes persist; comments are stored pending and shown only after approval.
- Homepage sections, labels, ordering, filters and SEO come from `homepage_settings`.
- Navbar and Footer categories use one lightweight cached navigation request.
- Search uses indexed word matching in title, tags, category slugs and language, with 300 ms debounce, stale-request cancellation, a 30-second backend cache and at most 7 playable suggestions. Partial-word autocomplete and typo correction are not implemented.
- Downloads remain outside the current connected watch-page flow.

## Checks and production

Run `npm test`, `npm run typecheck` and `npm run build` at the root. Run `npm test` in `backend/` for offline checks. Backend integration/load tests are explicit commands and require a suitable test environment.

Production requires HTTPS site origins, reachable Redis, private secrets and persistent sitemap storage. Run the frontend on a different port from the backend; put a reverse proxy in front. Use `npm run sitemap` and `npm run worker` in `backend/` for sitemap generation. Next.js sitemap routes proxy those files. The included backend Dockerfile packages runtime code only; `backend/compose.yaml` is a development example with standalone MongoDB and must be adapted before production.

A cloud deployment does not include provider uploads or FFmpeg processing; continue running those private tools separately.
