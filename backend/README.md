# Catalog backend

Node.js 22.14+, Express, MongoDB and Redis. This folder contains the runtime backend; private adminhandlers and upload/media tooling are intentionally excluded.

Copy `.env.example` to `.env`, configure Atlas and secrets, then run `npm ci`, `npm run db:setup` and `npm start`. Setup includes catalog, interaction, moderated-comment and homepage collection/index infrastructure. Homepage configuration and catalog data are not seeded. Existing Atlas data is preserved. Transactional interactions require a replica set.

Production requires `REDIS_URL`, HTTPS `SITE_URL` and `PUBLIC_SITE_URL`, a strong `ADMIN_API_TOKEN`, and an `INTERACTION_PROXY_SECRET` matching the frontend. Keep database, Redis and admin credentials private. Configure verified player hostnames with `PROVIDER_HOSTS_JSON`.

Public APIs include `/api/home`, `/api/navigation`, `/api/categories`, `/api/categories/:slug/videos`, `/api/tags/:slug/videos`, `/api/videos/:slug` and `/api/search`. Views, votes and approved comments are proxied through Next.js with server-only credentials. New comments remain pending until private moderation tools approve them.

`npm test` runs offline checks. `npm run test:integration` uses a test database; do not point it at production. `npm run load:test` must target an authorized test environment. `npm run search:setup` idempotently creates the text-search index.

`npm run sitemap` generates sitemap files. `npm run worker` refreshes them periodically. API and worker require shared persistent `public/sitemaps` storage when containerized. The Dockerfile copies runtime code; `compose.yaml` is only a development example and uses standalone MongoDB. See the root README for the complete frontend/backend setup.
