# Stage 1: Build Frontend Assets
FROM node:20-slim AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Production Server & Worker Image
FROM node:20-slim
WORKDIR /app

# Install system dependencies: ffmpeg, ffprobe, ca-certificates
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Set production environment variables
ENV NODE_ENV=production \
    PORT=4000 \
    WORKER_MODE=inline

# Copy server package manifests and install production dependencies only
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server source code
COPY server/ ./server/

# Copy built client assets into server/public for unified deployment
COPY --from=client-builder /app/client/dist ./server/public

# Ensure temp directory exists for video processing
RUN mkdir -p /app/server/temp

WORKDIR /app/server

EXPOSE 4000

CMD ["node", "src/index.js"]
