import express from 'express';
import runLighthouse from './scripts/lighthouse.js';
import async from 'async'; // Import the async library

const app = express();
app.use(express.json()); // Use built-in JSON parser

const PORT = process.env.PORT || 3001;

// --- Create the Job Queue ---
// Define the worker function that processes each job
const lighthouseWorker = async (task, callback) => {
  console.log(`Processing job for URL: ${task.url} (Device: ${task.device})`);
  try {
    // Call the original runLighthouse function
    // NOTE: runLighthouse itself handles posting to the webhook
    await runLighthouse({ url: task.url, webhook: task.webhook, device: task.device });
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
  const { url, webhook, device = 'mobile' } = req.body;

  if (!url || !webhook) {
    return res.status(400).json({ error: 'Missing required parameters: url and webhook.' });
  }

  if (!['mobile', 'desktop'].includes(device)) {
    return res.status(400).json({ error: 'Invalid device parameter. Must be \'mobile\' or \'desktop\'.' });
  }

  // Create the job task object
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
});
