# VidStream Production Dockerfile (Express API + ffmpeg worker)
FROM node:20-slim

# Install system dependencies including ffmpeg and ffprobe
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy server package definitions and install production dependencies
COPY server/package*.json ./server/
RUN npm --prefix server ci --omit=dev

# Copy server source code
COPY server ./server

ENV NODE_ENV=production
ENV PORT=4000
ENV WORKER_MODE=inline

EXPOSE 4000

CMD ["npm", "--prefix", "server", "start"]
