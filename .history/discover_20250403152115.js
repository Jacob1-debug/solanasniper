// Load env variables from .env
require("dotenv").config();

const axios = require("axios");

const API_KEY = process.env.BIRDEYE_API_KEY;

if (!API_KEY) {
  console.error("❌ BIRDEYE_API_KEY is missing from .env");
  process.exit(1);
}

async function getNewListings() {
  try {
    const res = await axios.get("https://public-api.birdeye.so/defi/v2/tokens/new_listing", {
      headers: {
        "x-chain": "solana",
        "X-API-KEY": API_KEY,
      },
    });

    const tokens = res.data.data;

    if (!tokens || tokens.length === 0) {
      console.log("⚠️ No new tokens found.");
      return;
    }

    console.log("🟢 New Listings (Last 5):");
    tokens.slice(0, 5).forEach((token, i) => {
      console.log(`${i + 1}. ${token.name} (${token.symbol})`);
      console.log(`   Address: ${token.address}`);
      console.log(`   Created At: ${new Date(token.createdTime).toLocaleString()}\n`);
    });
  } catch (err) {
    console.error("❌ Error fetching new tokens:", err.message);
  }
}

getNewListings();
