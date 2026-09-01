# syntax=docker/dockerfile:1.7

FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable \
  && corepack prepare pnpm@11.21.0 --activate

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
  && test -f packages/contracts/dist/index.js \
  && cd apps/web \
  && node --input-type=module --eval "await import('@study/contracts')"
ARG VITE_ENABLE_DEMO_COURSE_CATALOG=false
ARG VITE_QA_DEMO_BUILD=false
ARG VITE_RELEASE_SCOPE=READ_ONLY_BETA
ENV VITE_ENABLE_DEMO_COURSE_CATALOG=$VITE_ENABLE_DEMO_COURSE_CATALOG
ENV VITE_QA_DEMO_BUILD=$VITE_QA_DEMO_BUILD
ENV VITE_RELEASE_SCOPE=$VITE_RELEASE_SCOPE
RUN test "$VITE_ENABLE_DEMO_COURSE_CATALOG" = "false" \
  && test "$VITE_QA_DEMO_BUILD" = "false" \
  && test "$VITE_RELEASE_SCOPE" = "READ_ONLY_BETA" \
  && pnpm --filter @study/web build

FROM caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648 AS gateway

COPY ops/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /workspace/apps/web/dist/ /srv/

EXPOSE 80 443
