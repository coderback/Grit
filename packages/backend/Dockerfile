# Build context: packages/backend (the same root directory Railway uses).
# Railway still builds with Nixpacks; this image is for running the API
# anywhere else that runs containers.

# ---- build ----
FROM node:22-slim AS build
WORKDIR /app

# Prisma's query engine needs OpenSSL, which the slim image doesn't ship.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Install first so this layer is cached until package.json changes.
# There is no lockfile in the repo, so versions resolve fresh on each build.
COPY package.json ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund

COPY . .
# The build script runs prisma generate before nest build.
RUN npm run build \
  && test -f dist/main.js \
  && npm prune --omit=dev

# ---- runtime ----
FROM node:22-slim
WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/dist ./dist
# Read at runtime by the exercises module (data/exercises.json).
COPY --from=build --chown=node:node /app/data ./data

USER node
EXPOSE 3000

# Run node directly (not via npm) so SIGTERM reaches the app and its
# shutdown hooks run.
CMD ["node", "dist/main"]
