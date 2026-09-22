ARG BUN_VERSION=1.2.8
FROM oven/bun:${BUN_VERSION}-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN bun run build

FROM oven/bun:${BUN_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data && chown -R bun:bun /app
VOLUME ["/app/data"]
USER bun
CMD ["bun", "dist/index.js"]
