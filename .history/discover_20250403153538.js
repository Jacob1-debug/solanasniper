require("dotenv").config();
const axios = require("axios");

const API_KEY = process.env.BIRDEYE_API_KEY;

if (!API_KEY) {
  console.error("❌ Missing API key in .env");
  process.exit(1);
}

async function testBirdeye() {
  try {
    const res = await axios.get("", {
      headers: {
        "X-API-KEY": API_KEY,
        "x-chain": "solana",
      },
    });

    console.log("✅ It works. Got listings:");
    console.log(res.data.data.slice(0, 3)); // Show 3 tokens
  } catch (err) {
    console.error("❌ API request failed:", err.response?.data || err.message);
  }
}

testBirdeye();
