# Build context for this Dockerfile is the repo ROOT (not nginx/), since the
# frontend build needs to see the whole pnpm workspace — every package's
# package.json, not just one app's.

FROM node:22-alpine AS frontend-build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

COPY frontend/pnpm-workspace.yaml frontend/pnpm-lock.yaml frontend/package.json ./frontend/
COPY frontend/apps/client/package.json ./frontend/apps/client/package.json
COPY frontend/apps/admin/package.json ./frontend/apps/admin/package.json
COPY frontend/packages/ui/package.json ./frontend/packages/ui/package.json
COPY frontend/packages/api/package.json ./frontend/packages/api/package.json
COPY frontend/packages/config/package.json ./frontend/packages/config/package.json

WORKDIR /app/frontend
RUN pnpm install --frozen-lockfile

WORKDIR /app
COPY frontend/ ./frontend/
# The fixed, committed build-time flags (see .env.production) — never the
# developer's own .env, which could have VITE_API_MOCKS=true for local work.
COPY .env.production ./.env.production

WORKDIR /app/frontend
RUN pnpm build

FROM nginx:alpine
RUN apk add --no-cache openssl

COPY --from=frontend-build /app/frontend/apps/client/dist /usr/share/nginx/html
COPY --from=frontend-build /app/frontend/apps/admin/dist /usr/share/nginx/html/admin
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/generate-cert.sh /docker-entrypoint.d/10-generate-cert.sh
RUN chmod +x /docker-entrypoint.d/10-generate-cert.sh

EXPOSE 80 443
