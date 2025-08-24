# Production Dockerfile for FMP Data System
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ postgresql-client

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production
RUN npm install -g typescript

# Copy source code
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY sql/ ./sql/

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache postgresql-client bash curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --chown=nodejs:nodejs sql/ ./sql/
COPY --chown=nodejs:nodejs scripts/*.sh ./scripts/

# Create directories for logs and data
RUN mkdir -p /app/logs /app/data && \
    chown -R nodejs:nodejs /app/logs /app/data

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node dist/src/health-check.js || exit 1

# Environment variables (will be overridden by docker-compose or k8s)
ENV NODE_ENV=production \
    LOG_LEVEL=info \
    FMP_RATE_LIMIT_PER_MINUTE=2800 \
    FMP_RATE_LIMIT_PER_DAY=25000

# Expose metrics port
EXPOSE 9090

# Default command
CMD ["node", "dist/scripts/update-complete-fmp-data.js", "incremental"]