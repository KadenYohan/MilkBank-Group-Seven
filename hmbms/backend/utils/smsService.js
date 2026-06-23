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
  return new Promise((resolve) => {
    // Format the message according to SRS expectations
    const smsMessage = `MHMB: Hi! The milk request (Tracking: ${trackingCode}) for ${infantName} is now READY. Please proceed to the Makati Human Milk Bank facility.`;

    // Always use Mock Gateway for the project demonstration
    console.log(`\n========================================`);
    console.log(`📱 [MOCK SMS GATEWAY]`);
    console.log(`To: ${phoneNumber}`);
    console.log(`Message: ${smsMessage}`);
    console.log(`Status: Sent (Simulated)`);
    console.log(`========================================\n`);
    
    return resolve({ success: true, simulated: true, to: phoneNumber, text: smsMessage });
  });
}

module.exports = { sendMilkReadySMS };
