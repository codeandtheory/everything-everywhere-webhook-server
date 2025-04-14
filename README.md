# Modular Lighthouse Audit Server

## Overview

This Node.js server provides an HTTP endpoint to trigger Lighthouse audits on specified URLs. It simulates both mobile and desktop devices, runs the audits sequentially using a queue, and sends a summarized JSON report back to a provided webhook URL (e.g., an n8n webhook).

This is useful for automating website audits as part of a workflow.

## Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js:** (LTS version recommended) - [Download Node.js](https://nodejs.org/)
*   **npm:** (Comes with Node.js)
*   **ngrok:** (For exposing your local server to the internet) - [Download ngrok](https://ngrok.com/download)

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd <repository-directory>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Configuration

This server can be configured using environment variables:

*   `PORT`: The port the server listens on (Default: `3001`).

### Setting Environment Variables (Example for Linux/macOS)

You can set the port before running the server:

```bash
export PORT=8080

# Then start the server using npm or pm2
npm start 
# OR
pm2 start ecosystem.config.js 
```

When using PM2, it will automatically pick up environment variables set in the shell or you can define them directly in the `env` section of `ecosystem.config.js`.

When running with Docker, use the `-e` flag:

```bash
docker run -d -p 3001:3001 \
  -e PORT=3001 \
  --name lighthouse-server-container \
  lighthouse-server-app
```

## Running the Server (Development - using nodemon or node)

For local development, you can run the server directly:

```bash
npm start 
```

This typically uses `node server.js`. The server will run in the foreground.

## Running the Server (Production - using PM2)

For deployment on a server (like EC2), it's recommended to use a process manager like `pm2` to keep the server running reliably in the background.

1.  **Install PM2 globally (if not already installed):**
    ```bash
    npm install pm2 -g
    ```

2.  **Navigate to the project directory:**
    ```bash
    cd <repository-directory>
    ```

3.  **Start the server using the configuration file:**
    ```bash
    pm2 start ecosystem.config.js
    ```
    This will start the `lighthouse-server` application as defined in `ecosystem.config.js`.

4.  **Check Status & Logs:**
    ```bash
    pm2 list                # See running processes
    pm2 logs lighthouse-server # View server logs
    pm2 stop lighthouse-server # Stop the server
    pm2 restart lighthouse-server # Restart the server
    pm2 delete lighthouse-server # Remove from PM2 list
    ```

5.  **Enable Startup on Reboot (Important for Servers):**
    ```bash
    pm2 startup
    ```
    Follow the instructions output by `pm2 startup` (usually involves running a command with `sudo`). This ensures PM2 restarts your application if the server reboots.
    ```bash
    pm2 save
    ```
    Saves the current process list managed by PM2.

## Exposing with ngrok

To allow external services (like n8n cloud) to reach your local server, you need to expose it using ngrok.

1.  **Authenticate ngrok (if you haven't already):** Follow the instructions on the ngrok website after signing up.

2.  **Start ngrok:** Open a *new terminal window* and run:
    ```bash
    ngrok http 3001
    ```

3.  **Get the public URL:** ngrok will display output similar to this:
    ```
    Session Status                online
    Account                       Your Name (Plan: Free)
    Version                       x.x.x
    Region                        United States (us-cal-1)
    Forwarding                    https://xxxx-xxxx-xxxx-xxxx.ngrok-free.app -> http://localhost:3001
    ```
    Copy the `https://xxxx-....ngrok-free.app` URL. This is your public URL that external services can use to reach your server.

## Usage

Send a `POST` request to the `/run-lighthouse` endpoint on your server (using the `ngrok` URL if accessed externally).

The request body must be JSON and **must** contain:

*   `url` (string, required): The URL to audit.
*   `webhook` (string, required): The webhook URL where the results should be sent.

It can also optionally contain:

*   `device` (string, optional): The device type to simulate. Can be `'mobile'` or `'desktop'`. Defaults to `'mobile'` if omitted.

### Example Request (Mobile - Default)

```bash
curl -X POST \
  https://YOUR_NGROK_URL.ngrok-free.app/run-lighthouse \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://www.example.com",
    "webhook": "YOUR_N8N_WEBHOOK_URL"
  }'
```

### Example Request (Desktop)

```bash
curl -X POST \
  https://YOUR_NGROK_URL.ngrok-free.app/run-lighthouse \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://www.example.com",
    "webhook": "YOUR_N8N_WEBHOOK_URL",
    "device": "desktop"
  }'
```

Replace `YOUR_NGROK_URL.ngrok-free.app` and `YOUR_N8N_WEBHOOK_URL` with your actual URLs.

**Important Notes for n8n Users:**

*   **HTTP Request Node:** When configuring the HTTP Request node in your n8n workflow to call this server, make sure the `URL` field uses the **public `ngrok` URL** you obtained (e.g., `https://YOUR_NGROK_URL.ngrok-free.app/run-lighthouse`). Do **not** use `http://localhost:3001` unless n8n is running on the exact same machine as this server.
*   **Webhook URL Parameter:** The `webhook` value you provide in the request body **must** be the URL of the **n8n Webhook node** that will *receive* the Lighthouse results. Remember to switch from the *Test URL* to the *Production URL* in your n8n Webhook node settings when you activate your workflow.
*   **HTTP Request Body Structure:** Ensure the *Body Content Type* in the n8n HTTP Request node is set to `JSON`. The JSON body itself should be structured like this, likely using n8n expressions (`{{ ... }}`) to insert dynamic values:
    ```json
    {
      "url": "{{ $json.urlToAudit }}",
      "webhook": "YOUR_N8N_PRODUCTION_WEBHOOK_URL_FOR_RESULTS",
      "device": "{{ $json.deviceType || 'mobile' }}" 
    }
    ```
    *(Replace `YOUR_N8N_PRODUCTION_WEBHOOK_URL_FOR_RESULTS` with the actual URL. Adjust the `{{ $json... }}` expressions based on where your input data (URL to audit, desired device type) comes from in the n8n workflow.)*

## Running with Docker (Optional)

Alternatively, you can build and run this application using Docker. This is useful for creating a consistent environment for deployment.

**Prerequisites:** Docker must be installed.

1.  **Build the Docker Image:**
    From the root of the project directory, run:
    ```bash
    docker build -t lighthouse-server-app .
    ```
    This builds the image using the instructions in the `Dockerfile` and tags it as `lighthouse-server-app`.

2.  **Run the Docker Container:**
    ```bash
    docker run -d -p 3001:3001 --name lighthouse-server-container lighthouse-server-app
    ```

    The server should now be running inside the container, accessible at `http://localhost:3001` (or the server's IP if running on a remote machine).

3.  **Check Container Logs:**
    ```bash
    docker logs lighthouse-server-container
    ```

4.  **Stop and Remove the Container:**
    ```bash
    docker stop lighthouse-server-container
    docker rm lighthouse-server-container
    ```

## Server Response

The server will immediately respond with a `