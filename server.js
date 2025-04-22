import express from 'express';
import runLighthouse from './scripts/lighthouse.js';
import async from 'async'; // Import the async library

const app = express();
app.use(express.json()); // Use built-in JSON parser

const PORT = process.env.PORT || 3001;
// Remove environment variable constant and check
// const PROD_WEBHOOK_URL = process.env.N8N_PROD_WEBHOOK_URL;
// if (process.env.NODE_ENV === 'production' && !PROD_WEBHOOK_URL) { ... }

// --- Create the Job Queue ---

// Define the worker function - simplified
const lighthouseWorker = async (task) => {
  // The queue requires a function that accepts task AND callback,
  // but we won't use the callback directly here.
  // Instead, we rely on the promise returned by this async function.
  const targetWebhook = task.webhook;
  console.log(`Processing job for URL: ${task.url} (Device: ${task.device}) -> Sending to ${targetWebhook}`);
  // Simply await runLighthouse. If it succeeds, the promise resolves.
  // If it throws, the promise rejects, and the queue's .error handler will catch it.
  await runLighthouse({ url: task.url, webhook: targetWebhook, device: task.device });
  // Log success *after* await completes successfully
  console.log(`Worker finished processing job for URL: ${task.url} (Device: ${task.device})`);
};

// Create a queue object with concurrency 1
const lighthouseQueue = async.queue(lighthouseWorker, 1);

// Optional: Assign a callback for when the queue is drained (empty)
lighthouseQueue.drain(async () => {
  console.log('All items have been processed and queue is empty.'); // Clarified log
});

// Assign an error handler for errors thrown by the worker
lighthouseQueue.error(function(err, task) {
    console.error(`Worker caught an error processing task for URL: ${task?.url} (Device: ${task?.device})`);
    // Log the error object itself
    console.error(err);
    // Note: The queue will continue processing other items unless configured otherwise.
    // runLighthouse should have already tried to send an error to the webhook if possible.
});
// --- End Job Queue Setup ---

app.post('/run-lighthouse', (req, res) => {
  const { url, webhook, device = 'mobile' } = req.body;

  if (!url || !webhook) { 
    return res.status(400).json({ 
        error: 'Missing required parameters: url and webhook.' 
    });
  }

  if (!['mobile', 'desktop'].includes(device)) {
    return res.status(400).json({ error: 'Invalid device parameter. Must be \'mobile\' or \'desktop\'.' });
  }

  const task = { url, webhook, device }; 

  lighthouseQueue.push(task);
  console.log(`Added job to queue for: ${url} (Device: ${device}). Queue length: ${lighthouseQueue.length()}`);

  res.status(202).json({ 
    message: `Lighthouse audit for ${url} (${device}) has been queued.`,
    queueLength: lighthouseQueue.length()
   });
});

app.listen(PORT, () => {
  // Remove logs related to N8N_PROD_WEBHOOK_URL
  console.log(`💡 Lighthouse server with queue running on http://localhost:${PORT}`);
  /* 
  if (PROD_WEBHOOK_URL) { ... } else { ... } 
  */
});
