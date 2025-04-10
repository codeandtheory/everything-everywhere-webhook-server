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

## Running the Server

1.  **Start the server:**
    ```bash
    npm start
    ```
    By default, the server listens on port 3001. You should see output like:
    ```
    💡 Lighthouse server with queue running on http://localhost:3001
    ```

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

The request body must be JSON and contain:

*   `url` (string, required): The URL to audit.
*   `webhook` (string, required): The webhook URL where the results should be sent.
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
*   **Webhook URL Parameter:** The `webhook` value you provide in the request body should be the URL of the **n8n Webhook node** that will *receive* the Lighthouse results. Remember to switch from the *Test URL* to the *Production URL* in your n8n Webhook node settings when you activate your workflow.
*   **HTTP Request Body Structure:** Ensure the *Body Content Type* in the n8n HTTP Request node is set to `JSON`. The JSON body itself should be structured like this, likely using n8n expressions (`{{ ... }}`) to insert dynamic values:
    ```json
    {
      "url": "{{ $json.urlToAudit }}",
      "webhook": "YOUR_N8N_PRODUCTION_WEBHOOK_URL_FOR_RESULTS",
      "device": "{{ $json.deviceType || 'mobile' }}" 
    }
    ```
    *(Replace `YOUR_N8N_PRODUCTION_WEBHOOK_URL_FOR_RESULTS` with the actual URL. Adjust the `{{ $json... }}` expressions based on where your input data (URL to audit, desired device type) comes from in the n8n workflow.)*

## Server Response

The server will immediately respond with a `