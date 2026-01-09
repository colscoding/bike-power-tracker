# Multi-stage build for optimized production image
# Stage 1: Dependencies
FROM node:18-alpine AS deps

# Set working directory
WORKDIR /app

# Copy package files only (for better caching)
COPY package*.json ./
COPY prisma ./prisma/

RUN ls -la

# Install ALL dependencies (need devDependencies for build)
RUN npm install -g pnpm && pnpm -v
RUN rm package-lock.json && pnpm install

# Generate Prisma client
RUN npx prisma generate

# Stage 2: Builder
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./

# Install pnpm for building
RUN npm install -g pnpm

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript to JavaScript
RUN pnpm run build

# Stage 3: Production
FROM node:18-alpine AS production

# Install dumb-init to handle signals properly (critical for graceful shutdown)
# Also install tini as a fallback init system
# Install OpenSSL for Prisma
RUN apk add --no-cache dumb-init tini openssl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
# Using --ignore-scripts to skip postinstall, we'll run prisma generate separately
# We install ALL deps first (to get prisma CLI), generate client, then prune dev deps
RUN npm install -g pnpm && \
    rm package-lock.json && \
    pnpm install --ignore-scripts && \
    npx prisma generate && \
    pnpm prune --prod && \
    rm -rf /root/.local/share/pnpm/store /tmp/*

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

# Use dumb-init as PID 1 for proper signal handling
# This ensures SIGTERM is properly forwarded to the Node.js process
ENTRYPOINT ["dumb-init", "--"]

# Start the compiled application
CMD ["node", "dist/server.js"]
