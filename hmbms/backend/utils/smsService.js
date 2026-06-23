const https = require('https');
const querystring = require('querystring');

/**
 * Sends an SMS notification via the Semaphore API.
 * Uses a mock console log if SEMAPHORE_API_KEY is not set in .env.
 * 
 * @param {string} phoneNumber - Recipient's mobile number (e.g., "09171234567")
 * @param {string} trackingCode - The request tracking code
 * @param {string} infantName - Name of the infant recipient
 */
async function sendMilkReadySMS(phoneNumber, trackingCode, infantName) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.SEMAPHORE_API_KEY;
    
    // Format the message according to SRS expectations
    const smsMessage = `MHMB: Hi! The milk request (Tracking: ${trackingCode}) for ${infantName} is now READY. Please proceed to the Makati Human Milk Bank facility.`;

    // 1. Mock Gateway (If no API key is provided)
    if (!apiKey || apiKey === 'mock_key') {
      console.log(`\n========================================`);
      console.log(`📱 [MOCK SMS GATEWAY]`);
      console.log(`To: ${phoneNumber}`);
      console.log(`Message: ${smsMessage}`);
      console.log(`Status: Sent (Simulated)`);
      console.log(`========================================\n`);
      return resolve({ success: true, simulated: true, to: phoneNumber, text: smsMessage });
    }

    // 2. Real Semaphore Gateway
    const postData = querystring.stringify({
      apikey: apiKey,
      number: phoneNumber,
      message: smsMessage
      // Note: Custom 'sendername' requires an approved sender ID from Semaphore.
      // Omitting it will default to 'SEMAPHORE'.
    });

    const options = {
      hostname: 'api.semaphore.co',
      port: 443,
      path: '/api/v4/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          console.log(`[SMS SUCCESS] Sent to ${phoneNumber}:`, parsedData);
          resolve({ success: true, data: parsedData });
        } catch (e) {
          console.log(`[SMS SUCCESS] Sent to ${phoneNumber}:`, data);
          resolve({ success: true, data }); // Raw response
        }
      });
    });

    req.on('error', (e) => {
      console.error('[SMS ERROR] Failed to send SMS:', e.message);
      // We resolve false instead of rejecting to avoid crashing the server if SMS fails
      resolve({ success: false, error: e.message });
    });

    req.write(postData);
    req.end();
  });
}

module.exports = { sendMilkReadySMS };
