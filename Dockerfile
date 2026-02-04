# Cortex Server - Railway Deployment
FROM node:22-slim

WORKDIR /app

# Copy everything
COPY . .

# Install dependencies
RUN npm install

# Build all packages
RUN npm run build

# Set working directory to server
WORKDIR /app/packages/server

# Expose port (Railway will set PORT env var)
EXPOSE ${PORT:-4021}

# Start server
CMD ["node", "dist/index.js"]
