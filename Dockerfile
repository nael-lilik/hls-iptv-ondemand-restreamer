FROM node:20-alpine AS base

# Install FFmpeg and dependencies
RUN apk add --no-cache \
    ffmpeg \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create HLS output directory
RUN mkdir -p /tmp/hls

# Expose ports
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "src/index.js"]
