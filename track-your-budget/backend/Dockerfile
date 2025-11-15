# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install production dependencies (change to `npm install` for dev)
RUN npm ci --only=production

# Copy source code
COPY . .

# Set environment port and expose it
ENV PORT=4000
EXPOSE 4000

# Start the server
CMD ["node", "server.js"]
