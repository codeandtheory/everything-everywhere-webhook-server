import express from 'express';
import runLighthouse from './scripts/lighthouse.js';
import async from 'async'; // Import the async library

const app = express();
app.use(express.json()); // Use built-in JSON parser

const PORT = process.env.PORT || 3001;
const PROD_WEBHOOK_URL = process.env.N8N_PROD_WEBHOOK_URL;

// Check if the production webhook URL is set in production environment
if (process.env.NODE_ENV === 'production' && !PROD_WEBHOOK_URL) {
  console.error('FATAL ERROR: N8N_PROD_WEBHOOK_URL environment variable is not set.');
  process.exit(1); // Exit if the required env var is missing in prod
}

// --- Create the Job Queue ---
// Define the worker function that processes each job
const lighthouseWorker = async (task, callback) => {
  // Use the production webhook URL if available, otherwise use the one from the task (for testing/flexibility)
  const targetWebhook = PROD_WEBHOOK_URL || task.webhook; 
  console.log(`Processing job for URL: ${task.url} (Device: ${task.device}) -> Sending to ${targetWebhook}`);
  try {
    // Pass the determined webhook URL to runLighthouse
    await runLighthouse({ url: task.url, webhook: targetWebhook, device: task.device });
    console.log(`Finished job for URL: ${task.url} (Device: ${task.device})`);
    // Call callback without an error to indicate success
    callback(); 
  } catch (error) {
    console.error(`Job failed for URL: ${task.url} (Device: ${task.device}):`, error.message);
    // Call callback with an error (optional, depending on desired queue behavior)
    // The error here is mainly for the queue itself, runLighthouse handles webhook error reporting
    callback(error); 
  }
};

// Create a queue object with concurrency 1
const lighthouseQueue = async.queue(lighthouseWorker, 1); // Concurrency set to 1

// Optional: Assign a callback for when the queue is drained (empty)
lighthouseQueue.drain(async () => {
  console.log('All items have been processed');
});

// Optional: Assign an error callback for worker errors
lighthouseQueue.error(function(err, task) {
    console.error('Worker error processing task:', task, err);
});
// --- End Job Queue Setup ---

app.post('/run-lighthouse', (req, res) => { // Removed async here, not needed for pushing
  // Webhook from body is now optional if N8N_PROD_WEBHOOK_URL is set
  const { url, webhook, device = 'mobile' } = req.body;

  // URL is always required
  if (!url) {
    return res.status(400).json({ error: 'Missing required parameter: url.' });
  }

  // Webhook is required *only if* the N8N_PROD_WEBHOOK_URL env var is NOT set
  if (!PROD_WEBHOOK_URL && !webhook) {
      return res.status(400).json({ 
        error: 'Missing required parameter: webhook (or N8N_PROD_WEBHOOK_URL env var must be set on server).' 
      });
  }

  if (!['mobile', 'desktop'].includes(device)) {
    return res.status(400).json({ error: 'Invalid device parameter. Must be \'mobile\' or \'desktop\'.' });
  }

  // Create the job task object - store the webhook from the request if provided
  const task = { url, webhook, device }; 

  // Add the task to the queue
  lighthouseQueue.push(task, (err) => {
    if (err) {
      console.error(`Failed to add task to queue for ${url}:`, err);
      // Optionally, inform the client the push failed
      // return res.status(500).json({ message: "Failed to queue job." }); 
    } else {
      console.log(`Added job to queue for: ${url} (Device: ${device}). Queue length: ${lighthouseQueue.length()}`);
    }
  });

  // Respond immediately that the job has been queued
  res.status(202).json({ 
    message: `Lighthouse audit for ${url} (${device}) has been queued.`,
    queueLength: lighthouseQueue.length()
   });

  // --- Remove direct call to runLighthouse --- 
  /* 
  try {
    runLighthouse({ url, webhook, device }); 
    console.log(`Lighthouse process started for ${url} (${device}). Results will be sent to ${webhook}`);
  } catch (error) {
    console.error(`Error starting Lighthouse for ${url} (${device}):`, error);
  }
  */
});

app.listen(PORT, () => {
  console.log(`💡 Lighthouse server with queue running on http://localhost:${PORT}`);
  if (PROD_WEBHOOK_URL) {
      console.log(`   Configured to send results to: ${PROD_WEBHOOK_URL}`);
  } else {
      console.log(`   WARNING: N8N_PROD_WEBHOOK_URL env var not set. Expecting webhook URL in request body.`);
  }
});
