# Use the tiny Alpine-based Bun image
FROM oven/bun:alpine
WORKDIR /app

# Only copy dependency files first (best for caching)
COPY package.json bun.lockb* ./
RUN bun install

# Copy the rest of the code
COPY . .

EXPOSE 3000

# Use --watch for instant restarts inside Docker
CMD ["bun", "--watch", "src/index.ts"]