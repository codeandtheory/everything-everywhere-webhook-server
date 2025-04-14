# Use an official Node.js runtime as a parent image (Choose LTS version)
FROM node:18-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Install necessary dependencies for Puppeteer and Chromium (instead of Chrome)
RUN apt-get update && apt-get install -y \
    # Install Chromium browser for ARM64 compatibility
    chromium \
    # Needed by Puppeteer/Chromium
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
    wget \
    gnupg \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json (or npm-shrinkwrap.json)
COPY package*.json ./

# Install app dependencies using npm ci for faster, more reliable builds
RUN npm ci --only=production

# Bundle app source inside Docker image
COPY . .

# Expose the port the app runs on
EXPOSE 3001

# Define the command to run the app
# Using node directly is often sufficient for containers
CMD [ "node", "server.js" ]

# Alternatively, if you prefer PM2 inside the container (requires adding pm2 to package.json dependencies):
# RUN npm install pm2 -g
# CMD [ "pm2-runtime", "start", "ecosystem.config.js" ] 