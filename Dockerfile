# Build stage for frontend
FROM oven/bun:1 AS frontend-builder

WORKDIR /app

# Copy frontend package files
COPY frontend/package.json frontend/bun.lock ./frontend/

# Install frontend dependencies
WORKDIR /app/frontend
RUN bun install

# Copy server files (needed for frontend build to resolve @shared types)
WORKDIR /app
COPY server/ ./server/

# Copy frontend source
COPY frontend/ ./frontend/

# Build frontend
WORKDIR /app/frontend
RUN bun run build

# Final stage
FROM oven/bun:1

WORKDIR /app

# Install playwright dependencies
RUN apt-get update && \
    apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy backend package files
COPY package.json bun.lock ./

# Install backend dependencies
RUN bun install

# Install playwright browsers
RUN bunx playwright install chromium

# Copy backend source
COPY server/ ./server/
COPY drizzle/ ./drizzle/
COPY drizzle.config.ts ./
COPY tsconfig.json ./

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port
EXPOSE 3000

# Set environment variable defaults
ENV NODE_ENV=production
ENV PORT=3000

# Run database migrations and start server
CMD ["sh", "-c", "bun run db:push && bun run start"]
