# syntax=docker/dockerfile:1.7

FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates g++ make python3 \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@11.21.0 --activate

ENV DATABASE_URL=postgresql://build_only:build_only@127.0.0.1:5432/build_only

WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/test-fixtures/package.json packages/test-fixtures/package.json

RUN --mount=type=cache,id=qinglang-pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @study/contracts build \
  && pnpm --filter @study/api build
RUN --mount=type=cache,id=qinglang-pnpm,target=/pnpm/store \
  pnpm --config.inject-workspace-packages=true \
  --filter @study/api deploy --prod /opt/api

FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS api

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /opt/api/ /app/
COPY --chmod=755 ops/api/entrypoint.sh /usr/local/bin/qinglang-api-entrypoint

USER node
EXPOSE 3001
ENTRYPOINT ["/usr/local/bin/qinglang-api-entrypoint"]
CMD ["node", "dist/main.js"]

FROM build AS migrate

ENV NODE_ENV=production
COPY --chmod=755 ops/api/entrypoint.sh /usr/local/bin/qinglang-api-entrypoint

WORKDIR /workspace/apps/api
USER node
ENTRYPOINT ["/usr/local/bin/qinglang-api-entrypoint"]
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]
