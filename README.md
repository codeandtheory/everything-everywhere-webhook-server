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

## Server Response

The server will immediately respond with a `202 Accepted` status and a JSON body indicating the job has been queued:

```json
{
  "message": "Lighthouse audit for https://www.example.com (mobile) has been queued.",
  "queueLength": 1 
}
```

The actual Lighthouse audit runs in the background. The results will be sent via a `POST` request to the `webhook` URL you provided once the audit is complete.

## Request Queue

To prevent resource conflicts and ensure stable audits, this server uses an internal job queue (`async.queue`). 

*   When a request is received at `/run-lighthouse`, the job details (`url`, `webhook`, `device`) are added to the end of the queue.
*   The server immediately sends back the `202 Accepted` response.
*   A single worker process takes jobs from the queue **one at a time**.
*   The worker runs the full Lighthouse audit (potentially two passes) for the current job.
*   Only after a job is completely finished (including sending the results to the webhook and closing the browser instance) does the worker take the next job from the queue.

This ensures that multiple concurrent requests are handled sequentially, avoiding errors caused by trying to run multiple resource-intensive Lighthouse audits simultaneously.

## Webhook Payload Structure

The JSON payload sent to your webhook URL will be an array containing a single object with the summarized Lighthouse results:

```json
[
  {
    "Device Type": "mobile", // or "desktop"
    "Url": "https://www.example.com",
    "Performance Score (%)": 85, // Can be null if performance run failed
    "Accessibility Score (%)": 95,
    "Best Practices Score (%)": 92,
    "Seo Score (%)": 100,
    "Primary Performance Issues": [ /* ... array of issues or "Skipped or Failed" */ ],
    "Primary Accessibility Issues": [ /* ... */ ],
    "Primary Best Practices Issues": [ /* ... */ ],
    "Primary SEO Issues": [ /* ... */ ],
    "🚩 Top 3 Priority Issues (Combined)": [ /* ... */ ],
    "Overall Health Estimate": "Needs Improvement" // Based on Performance Score
  }
]
```

Note: The performance score and issues might be `null` or `"Skipped or Failed"` if the performance audit pass encountered an unrecoverable error (e.g., browser crash) for a particularly complex site.

## (TODO)

Currently, this server requires `ngrok` for external access when run locally. The next step is to deploy this application to a persistent server environment, likely on AWS (e.g., using EC2 or ECS).

This will eliminate the need for `ngrok` and provide a stable, permanent endpoint for integrations like n8n.
