module.exports = {
  apps: [{
    name: 'lighthouse-server', // Application name displayed in PM2
    script: 'server.js', // Script to run
    instances: 1, // Run a single instance (important for the queue)
    autorestart: true, // Restart if the app crashes
    watch: false, // Do not watch for file changes (can be unstable with builds)
    max_memory_restart: '1G', // Restart if it exceeds 1GB memory (adjust as needed)
    env: {
      NODE_ENV: 'production', // Set environment to production
      PORT: 3001 // Default port (can be overridden by EC2 environment variables)
    }
  }]
}; 