// Test script for Resend API
const RESEND_API_URL = "https://api.resend.com/emails";
const apiKey = process.env.RESEND_API_KEY;

console.log("Testing Resend API...");
console.log("API Key present:", apiKey ? "Yes (starts with " + apiKey.substring(0, 5) + "...)" : "No");

if (!apiKey) {
  console.error("RESEND_API_KEY not set!");
  process.exit(1);
}

const response = await fetch(RESEND_API_URL, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: "Ftour Bab Rayan <onboarding@resend.dev>",
    to: "test@example.com",
    subject: "Test Resend API",
    html: "<p>Test email from Ftour Bab Rayan</p>",
    reply_to: "contact@ftourbabrayan.ma",
  }),
});

const data = await response.json();
console.log("Response status:", response.status);
console.log("Response data:", JSON.stringify(data, null, 2));
