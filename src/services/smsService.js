const axios = require("axios");
const { env } = require("../config/env");

// Mock SMS Provider - logs messages to console
async function sendViaMock(phoneNumber, message) {
  console.log(`[SMS MOCK] To: ${phoneNumber}`);
  console.log(`[SMS MOCK] Message: ${message}`);
  return {
    success: true,
    messageId: `mock-${Date.now()}`,
    provider: "mock",
  };
}

// Africa's Talking SMS Provider - sends via REST API
async function sendViaAfricasTalking(phoneNumber, message) {
  if (!env.atApiKey) {
    console.warn("[SMS AT] Missing AT_API_KEY in environment - using mock response");
    return await sendViaMock(phoneNumber, message);
  }

  try {
    const url = "https://api.africastalking.com/version1/messaging/bulk";
    const payload = {
      username: env.atUsername,
      message: message,
      phoneNumbers: [phoneNumber],
      senderId: env.atSenderId || "BOOKMARKET",
    };

    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apiKey: env.atApiKey,
      },
      timeout: 15000,
    });

    if (response.data?.SMSMessageData?.Recipients?.[0]) {
      const recipient = response.data.SMSMessageData.Recipients[0];
      const statusCode = recipient.statusCode;

      // Status codes: 101 = Sent, 102 = Queued, 100 = Processed
      if (statusCode === 101 || statusCode === 100 || statusCode === 102) {
        return {
          success: true,
          messageId: recipient.messageId,
          status: recipient.status,
          provider: "africas-talking",
        };
      } else {
        console.error(`[SMS AT] Failed to send to ${phoneNumber}: Status ${statusCode}`);
        return {
          success: false,
          statusCode: statusCode,
          message: recipient.status,
          provider: "africas-talking",
        };
      }
    }

    console.error("[SMS AT] Unexpected response format:", response.data);
    return {
      success: false,
      message: "Unexpected API response",
      provider: "africas-talking",
    };
  } catch (error) {
    console.error(`[SMS AT] Error sending to ${phoneNumber}:`, error.message);
    return {
      success: false,
      error: error.message,
      provider: "africas-talking",
    };
  }
}

/**
 * Send SMS message to a phone number
 * @param {string} phoneNumber - Phone number (e.g., "+254711234567")
 * @param {string} message - Message content
 * @returns {Promise<Object>} Response with success status and messageId
 */
async function sendSMS(phoneNumber, message) {
  if (!phoneNumber || !message) {
    return {
      success: false,
      error: "Phone number and message are required",
    };
  }

  // Normalize phone number
  const normalizedPhone = phoneNumber.startsWith("+")
    ? phoneNumber
    : phoneNumber.startsWith("0")
      ? `+254${phoneNumber.slice(1)}`
      : `+${phoneNumber}`;

  const provider = env.smsProvider || "mock";

  if (provider === "africas-talking") {
    return await sendViaAfricasTalking(normalizedPhone, message);
  }

  // Default to mock
  return await sendViaMock(normalizedPhone, message);
}

/**
 * Send SMS to multiple recipients
 * @param {string[]} phoneNumbers - Array of phone numbers
 * @param {string} message - Message content
 * @returns {Promise<Object[]>} Array of send results
 */
async function sendSMSBulk(phoneNumbers, message) {
  if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
    return {
      success: false,
      error: "Phone numbers array is required",
    };
  }

  const results = await Promise.all(
    phoneNumbers.map((phone) => sendSMS(phone, message))
  );

  return {
    total: phoneNumbers.length,
    results: results,
  };
}

module.exports = {
  sendSMS,
  sendSMSBulk,
};
