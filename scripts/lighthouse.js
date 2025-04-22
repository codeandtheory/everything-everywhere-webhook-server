import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';
import axios from 'axios';
import { URL } from 'url';

// Helper function to determine impact based on score
/**
 * @param {number | null} score
 * @returns {'High' | 'Medium' | 'Low' | 'N/A'}
 */
function getImpact(score) {
  if (score === null) return 'N/A';
  if (score < 0.5) return 'High';
  if (score < 0.9) return 'Medium';
  return 'Low';
}

// Helper function to determine overall health
/**
 * Determines overall health based ONLY on performance score.
 * @param {number | null} performanceScore - Performance score (0-100) or null if not available/run.
 * @returns {'Good' | 'Needs Improvement' | 'Poor' | 'N/A (Performance test skipped or failed)'}
 */
function getOverallHealth(performanceScore) {
  if (performanceScore === null) return 'N/A (Performance test skipped or failed)';
  if (performanceScore >= 90) return 'Good';
  if (performanceScore >= 50) return 'Needs Improvement';
  return 'Poor';
}

// Helper function to extract relevant issues for a category
/**
 * @param {import('lighthouse').Lhr | null | undefined} report LHR report object or null/undefined
 * @param {string} categoryId Category ID (e.g., 'performance')
 * @returns {any[]}
 */
function getCategoryIssues(report, categoryId) {
  if (!report || !report.categories || !report.categories[categoryId] || !report.categories[categoryId].auditRefs) {
    return [];
  }
  const category = report.categories[categoryId];

  // Ensure report.audits exists before proceeding
  if (!report.audits) return [];

  return category.auditRefs
    .filter(ref => report.audits[ref.id]?.score !== null && (report.audits[ref.id]?.score ?? 1) < 0.9 && ref.weight > 0)
    .map(ref => {
      const audit = report.audits[ref.id];
      // Handle cases where audit might be missing (though unlikely if ref exists)
      if (!audit) return null;
      const score = audit.score ?? 0;
      return {
        Metric: audit.title ?? 'N/A',
        Description: audit.description ?? 'N/A',
        Score: Math.round(score * 100),
        Impact: getImpact(audit.score),
        DisplayValue: audit.displayValue ?? 'n/a'
      };
    })
    .filter(issue => issue !== null) // Remove any potential nulls if audit was missing
    .sort((a, b) => a.Score - b.Score);
}

// Helper function to get top N priority issues across all categories
/**
 * Gets top N issues from *all available* categories in the provided reports.
 * @param {(import('lighthouse').Lhr | null | undefined)[]} reports - An array of LHR reports (e.g., [perfReport, otherReport])
 * @param {number} count - Number of top issues to return
 * @returns {any[]}
 */
function getCombinedTopPriorityIssues(reports, count) {
  /** @type {any[]} */
  const allIssues = [];

  reports.forEach(report => {
    if (!report || !report.categories) return;

    Object.keys(report.categories).forEach(categoryId => {
      const category = report.categories[categoryId];
      if (!category || !category.auditRefs) return;

      // Ensure report.audits exists
      if (!report.audits) return;

      category.auditRefs.forEach(ref => {
        const audit = report.audits[ref.id];
        if (audit?.score !== null && audit.score < 0.9) {
          const score = audit.score ?? 0;
          allIssues.push({
            Metric: audit.title ?? 'N/A',
            Description: audit.description ?? 'N/A',
            Score: Math.round(score * 100),
            Impact: getImpact(audit.score),
            DisplayValue: audit.displayValue ?? 'n/a',
            Category: category.title ?? categoryId
          });
        }
      });
    });
  });

  const uniqueIssues = Array.from(new Map(allIssues.map(issue => [issue.Metric, issue])).values());
  return uniqueIssues
    .sort((a, b) => a.Score - b.Score)
    .slice(0, count);
}

/**
 * Runs Lighthouse potentially twice and sends a combined summarized report.
 * @param {{ url: string, webhook: string, device?: 'mobile' | 'desktop' }} options
 */
export default async function runLighthouse({ url, webhook, device = 'mobile' }) {
  let browser = null; // Initialize browser to null
  /** @type {import('lighthouse').Lhr | null} */
  let perfReport = null;
  /** @type {import('lighthouse').Lhr | null} */
  let otherReport = null;
  let port = null;

  console.log(`Starting Lighthouse run for ${url} on ${device}`);

  // --- Define Settings based on device --- 

  // Shared settings
  const baseSettings = {
    maxWaitForLoad: 100000, // Increased timeout to 100 seconds
  };

  // Mobile-specific settings
  const mobileThrottling = {
    rttMs: 40,
    throughputKbps: 10 * 1024,
    cpuSlowdownMultiplier: 4,
    requestLatencyMs: 0, 
    downloadThroughputKbps: 0,
    uploadThroughputKbps: 0
  };
  const mobileSettings = {
    ...baseSettings,
    throttling: mobileThrottling,
    throttlingMethod: "simulate", 
    formFactor: "mobile", 
    screenEmulation: {
      mobile: true,
      width: 360,
      height: 640,
      deviceScaleFactor: 2.625,
      disabled: false,
    },
    emulatedUserAgent: "Mozilla/5.0 (Linux; Android 7.0; Moto G (4)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4690.0 Mobile Safari/537.36 Chrome-Lighthouse"
  };

  // Desktop-specific settings
  const desktopSettings = {
    ...baseSettings,
    throttling: false, // Use 'provided' throttling essentially (or explicitly false)
    throttlingMethod: "provided", // No simulated throttling for desktop
    formFactor: "desktop",
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
    // Use a standard desktop user agent
    emulatedUserAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4690.0 Safari/537.36 Chrome-Lighthouse"
  };

  // Select settings based on the device parameter
  const selectedSettings = device === 'desktop' ? desktopSettings : mobileSettings;

  const lighthouseOptions = {
    output: 'json',
    logLevel: 'warn', 
    settings: selectedSettings // Use the selected settings object
  };

  // --- End Settings Definition --- 

  try {
    console.log(`Launching browser for ${url} (${device})...`);
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium', 
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ]
    });
    port = new URL(browser.wsEndpoint()).port;
    console.log(`Browser launched on port ${port}.`);

    // --- Run 1: Performance Only --- 
    try {
      console.log(`Running Lighthouse Pass 1 (Performance) for ${url} (${device})...`);
      const perfResult = await lighthouse(url, {
        ...lighthouseOptions, // Apply selected settings
        port,
        onlyCategories: ['performance'],
      });
      if (perfResult?.lhr) {
        perfReport = perfResult.lhr;
        console.log('Lighthouse Pass 1 (Performance) completed successfully.');
      } else {
        console.warn('Lighthouse Pass 1 (Performance) did not produce a report.');
      }
    } catch (error) {
      console.error(`Lighthouse Pass 1 (Performance) failed for ${url}:`, error.message);
      // Do not re-throw, allow Run 2 to proceed. perfReport remains null.
    }

    // --- Run 2: Other Categories --- 
    try {
      console.log(`Running Lighthouse Pass 2 (Other Categories) for ${url} (${device})...`);
      const otherResult = await lighthouse(url, {
        ...lighthouseOptions, // Apply selected settings
        port, 
        onlyCategories: ['accessibility', 'seo', 'best-practices'],
      });
       if (otherResult?.lhr) {
        otherReport = otherResult.lhr;
        console.log('Lighthouse Pass 2 (Other Categories) completed successfully.');
      } else {
        console.warn('Lighthouse Pass 2 (Other Categories) did not produce a report.');
      }
    } catch (error) {
      console.error(`Lighthouse Pass 2 (Other Categories) failed for ${url}:`, error.message);
      // If this fails, we might not have much useful data. otherReport remains null.
      // Consider re-throwing or specific handling if this run is critical.
      throw new Error(`Lighthouse Pass 2 (Other Categories) failed: ${error.message}`); // Throw if crucial categories fail
    }

    // --- Combine Results & Create Payload --- 
    console.log("Combining results...");

    // Get scores, defaulting to null if report or category is missing
    const performanceScore = perfReport?.categories?.performance ? Math.round((perfReport.categories.performance.score ?? 0) * 100) : null;
    const accessibilityScore = otherReport?.categories?.accessibility ? Math.round((otherReport.categories.accessibility.score ?? 0) * 100) : null;
    const bestPracticesScore = otherReport?.categories?.['best-practices'] ? Math.round((otherReport.categories['best-practices'].score ?? 0) * 100) : null;
    const seoScore = otherReport?.categories?.seo ? Math.round((otherReport.categories.seo.score ?? 0) * 100) : null;

    // Get issues, defaulting to empty array
    const performanceIssues = getCategoryIssues(perfReport, 'performance');
    const accessibilityIssues = getCategoryIssues(otherReport, 'accessibility');
    const bestPracticesIssues = getCategoryIssues(otherReport, 'best-practices');
    const seoIssues = getCategoryIssues(otherReport, 'seo');

    // Get top issues from *both* reports if they exist
    const top3Issues = getCombinedTopPriorityIssues([perfReport, otherReport].filter(r => r !== null), 3);
    const overallHealth = getOverallHealth(performanceScore);

    const summarizedPayload = [
      {
        "Device Type": device, // Add device type to payload
        "Url": url,
        "Performance Score (%)": performanceScore,
        "Accessibility Score (%)": accessibilityScore,
        "Best Practices Score (%)": bestPracticesScore,
        "Seo Score (%)": seoScore,
        "Primary Performance Issues": performanceScore !== null ? performanceIssues : "Skipped or Failed",
        "Primary Accessibility Issues": accessibilityScore !== null ? accessibilityIssues : "Skipped or Failed",
        "Primary Best Practices Issues": bestPracticesScore !== null ? bestPracticesIssues : "Skipped or Failed",
        "Primary SEO Issues": seoScore !== null ? seoIssues : "Skipped or Failed",
        "🚩 Top 3 Priority Issues (Combined)": top3Issues,
        "Overall Health Estimate": overallHealth
      }
    ];

    // --- Post to Webhook --- 
    try {
      console.log(`Attempting to POST combined ${device} results to webhook: ${webhook}`);
      const response = await axios.post(webhook, summarizedPayload, {
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Node-Lighthouse-Client/1.0' },
        timeout: 30000
      });
      console.log(`Successfully posted combined ${device} results to webhook. Status: ${response.status}`);
    } catch (error/*: any*/) {
      console.error(`Error posting combined ${device} results to webhook: ${webhook}`);
      // Log detailed webhook error (add checks for error.response etc. as before if needed)
      // @ts-ignore
      if (error.response) {
        // @ts-ignore
        console.error('Webhook Response Status:', error.response.status);
        // @ts-ignore
        console.error('Webhook Response Data:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        // @ts-ignore
        console.error('Webhook No response received:', error.request);
      } else {
        // @ts-ignore
        console.error('Webhook Error setting up request:', error.message);
      }
    }

    return summarizedPayload; // Return combined payload

  } catch (error /*: any*/) {
    // Catch errors from browser launch or critical Pass 2 failure
    console.error(`Critical error during ${device} Lighthouse process for ${url}:`, error.message);
    // Optionally attempt to send a failure message to the webhook
    try {
      await axios.post(webhook, { error: `Lighthouse process failed critically for ${url}`, details: error.message }, { timeout: 10000 });
    } catch (webhookError/*: any*/) {
      // @ts-ignore
      console.error(`Failed to send critical error report to webhook ${webhook}:`, webhookError.message);
    }
    // Re-throw the error so the calling server function knows the job failed overall
    throw error;
  } finally {
    if (browser) {
      try {
        console.log(`Closing browser for ${url} (${device})...`);
        await browser.close();
        console.log(`Browser closed for ${url} (${device}).`);
      } catch (closeError/*: any*/) {
        // @ts-ignore
        console.error(`Error closing the browser: ${closeError.message}`);
      }
    }
  }
}