FROM oven/bun:1.2.19-alpine AS builder
WORKDIR /app

# Install dependencies first for better caching
COPY ./package.json ./bun.lock ./
RUN bun install --frozen-lockfile

# Copy source and build
COPY . .
RUN bun run build

# Build web UI if needed (for console mode)
RUN cd web && bun install && bun run build || true

FROM oven/bun:1.2.19-alpine AS runner
WORKDIR /app

# Install production dependencies
COPY ./package.json ./bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts --no-cache

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/pages ./pages
COPY --from=builder /app/web/dist ./web/dist

# Expose ports (4141 for start mode, 3000/4141 for console mode)
EXPOSE 3000 4141

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:4141/ || wget --spider -q http://localhost:3000/ || exit 1

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

# Default: console mode (multi-account management)
CMD ["console"]
