// ============================================================
// HMBMS — SMS Service (iProg SMS / iprogsms.com)
// L-03: Real SMS integration replacing the mock gateway
// ============================================================

const https = require('https');

const IPROG_API_URL = 'https://iprogsms.com/api/v1/sms_messages';

/**
 * Sends an SMS via the iProg SMS API (iprogsms.com).
 * Falls back to mock console log if IPROG_SMS_TOKEN is not set.
 *
 * API:  POST https://iprogsms.com/api/v1/sms_messages
 * Body: { api_token, phone_number, message }
 *
 * @param {string} phoneNumber  - Recipient mobile number (e.g., "09171234567")
 * @param {string} trackingCode - The request tracking code
 * @param {string} infantName   - Name of the infant recipient
 */
async function sendMilkReadySMS(phoneNumber, trackingCode, infantName) {
  const smsMessage = `MHMB: Hi! The milk request (Tracking: ${trackingCode}) for ${infantName} is now READY. Please proceed to the Makati Human Milk Bank facility.`;

  const apiToken = process.env.IPROG_SMS_TOKEN;

  // ── Fallback to mock if no API key configured ──────────────
  if (!apiToken) {
    console.log(`\n========================================`);
    console.log(`📱 [MOCK SMS — set IPROG_SMS_TOKEN to send real SMS]`);
    console.log(`To: ${phoneNumber}`);
    console.log(`Message: ${smsMessage}`);
    console.log(`Status: Simulated (no API token)`);
    console.log(`========================================\n`);
    return { success: true, simulated: true, to: phoneNumber, text: smsMessage };
  }

  // ── Real iProg SMS API call ────────────────────────────────
  const payload = JSON.stringify({
    api_token: apiToken,
    phone_number: phoneNumber,
    message: smsMessage
  });

  const startMs = Date.now();

  return new Promise((resolve) => {
    const url = new URL(IPROG_API_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      timeout: 30000, // 30-second timeout (§4.6 requires delivery within 60s)
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const elapsedMs = Date.now() - startMs;
        try {
          const json = JSON.parse(data);
          if (json.status === 200) {
            console.log(`[iProg SMS] ✅ Sent to ${phoneNumber} | message_id: ${json.message_id} | ${elapsedMs}ms`);
            resolve({ success: true, message_id: json.message_id, to: phoneNumber, text: smsMessage, elapsed_ms: elapsedMs });
          } else {
            console.error(`[iProg SMS] Error response (${elapsedMs}ms):`, json);
            resolve({ success: false, error: json.message || 'Unknown error', simulated: false, elapsed_ms: elapsedMs });
          }
        } catch (parseErr) {
          console.error(`[iProg SMS] Failed to parse response (${elapsedMs}ms):`, data);
          resolve({ success: false, error: 'Invalid API response', simulated: false, elapsed_ms: elapsedMs });
        }
      });
    });

    req.on('timeout', () => {
      const elapsedMs = Date.now() - startMs;
      console.error(`[iProg SMS] ⏱️ Request timed out after ${elapsedMs}ms`);
      req.destroy();
      resolve({ success: false, error: 'SMS API request timed out', simulated: false, elapsed_ms: elapsedMs });
    });

    req.on('error', (err) => {
      const elapsedMs = Date.now() - startMs;
      console.error(`[iProg SMS] Network error (${elapsedMs}ms):`, err.message);
      resolve({ success: false, error: err.message, simulated: false, elapsed_ms: elapsedMs });
    });

    req.write(payload);
    req.end();
  });
}

module.exports = { sendMilkReadySMS };
