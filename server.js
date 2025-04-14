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
// Define the worker function that processes each job
const lighthouseWorker = async (task, callback) => {
  // Always use the webhook URL passed in the task object from the request body
  const targetWebhook = task.webhook; 
  // Log statement simplified as webhook is always from task now
  console.log(`Processing job for URL: ${task.url} (Device: ${task.device}) -> Sending to ${targetWebhook}`);
  let jobSucceeded = false;
  try {
    await runLighthouse({ url: task.url, webhook: targetWebhook, device: task.device });
    console.log(`Job completed successfully for URL: ${task.url} (Device: ${task.device})`);
    jobSucceeded = true;
  } catch (error) {
    // runLighthouse function already logs errors internally
    console.error(`Job processing caught error for URL: ${task.url} (Device: ${task.device}): ${error.message}`);
    // jobSucceeded remains false
  } finally {
    // Ensure callback is always called once after try/catch finishes
    // Pass the original error if one occurred? async queue might use this.
    // Let's just signal completion without error for now, as runLighthouse handles reporting.
    if (typeof callback === 'function') {
        console.log(`Calling queue callback for ${task.url}`);
        callback(); // Signal queue worker completion
    } else {
        // This case should ideally not happen if async library is working correctly
        console.error(`Internal Error: Worker callback was not a function for task ${task.url}`);
    }
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

app.post('/run-lighthouse', (req, res) => {
  // Get url, webhook, device from body. Webhook is now required.
  const { url, webhook, device = 'mobile' } = req.body;

  // URL and Webhook are now both required in the request body
  if (!url || !webhook) { 
    return res.status(400).json({ 
        error: 'Missing required parameters: url and webhook.' 
    });
  }
  
  // Remove check related to PROD_WEBHOOK_URL
  /*
  if (!PROD_WEBHOOK_URL && !webhook) {
      return res.status(400).json({ ... });
  }
  */

  if (!['mobile', 'desktop'].includes(device)) {
    return res.status(400).json({ error: 'Invalid device parameter. Must be \'mobile\' or \'desktop\'.' });
  }

  // Create the task object with required webhook
  const task = { url, webhook, device }; 

  // Add the task to the queue
  lighthouseQueue.push(task); 
  console.log(`Added job to queue for: ${url} (Device: ${device}). Queue length: ${lighthouseQueue.length()}`);

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
  // Remove logs related to N8N_PROD_WEBHOOK_URL
  console.log(`💡 Lighthouse server with queue running on http://localhost:${PORT}`);
  /* 
  if (PROD_WEBHOOK_URL) { ... } else { ... } 
  */
});
