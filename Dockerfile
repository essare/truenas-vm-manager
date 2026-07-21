FROM oven/bun:1.3.13-alpine AS web-build
WORKDIR /app

COPY package.json bun.lock ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN bun install --frozen-lockfile

COPY web/ ./web/
RUN bun run --filter web build

FROM oven/bun:1.3.13-alpine AS runtime
WORKDIR /app

COPY server/src ./server/src
COPY server/package.json ./server/package.json
COPY server/tsconfig.json ./server/tsconfig.json
COPY --from=web-build /app/web/dist ./web/dist

RUN mkdir -p /data

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787
ENV DATA_DIR=/data

EXPOSE 8787
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD bun -e 'fetch("http://127.0.0.1:8787/api/status").then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'

WORKDIR /app/server
CMD ["bun", "run", "src/index.ts"]
