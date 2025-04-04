require("dotenv").config();
const axios = require("axios");

const API_KEY = process.env.BIRDEYE_API_KEY;

if (!API_KEY) {
  console.error("❌ Missing API key in .env");
  process.exit(1);
}

async function testBirdeye() {
  try {
    const res = await axios.get("https://public-api.birdeye.so/defi/v2/tokens/new_listing", {
      headers: {
        "X-API-KEY": API_KEY,https://public-api.birdeye.so/defi/token_trending

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
