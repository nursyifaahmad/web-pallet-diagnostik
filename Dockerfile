FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3090
ENV DB_DIR=/app/data

# Create data directory for SQLite persistent storage
RUN mkdir -p /app/data

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY public/ ./public/
COPY scripts/ ./scripts/

# Run database seeder on build/start if needed
EXPOSE 3090

CMD ["sh", "-c", "node src/config/seed.js && node src/server.js"]
