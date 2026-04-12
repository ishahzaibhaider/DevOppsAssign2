# ── Stage: production image ───────────────────────────────────────────────────
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests first (leverages Docker layer cache)
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy the rest of the application source code
COPY . .

# Expose the port the app listens on
EXPOSE 3000

# Start the application
CMD ["node", "app.js"]
