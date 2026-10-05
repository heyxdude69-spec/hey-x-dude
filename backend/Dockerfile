FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src
COPY config ./config
COPY scripts/*.mjs ./scripts/
COPY public ./public
RUN mkdir -p /app/public/sitemaps && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "scripts/container_entrypoint.mjs"]
