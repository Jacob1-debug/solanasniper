const axios = require("axios");
require("dotenv").config();

const API_KEY = process.env.BIRDEYE_API_KEY;

async function getNewListings() {
  try {
    const res = await axios.get("https://public-api.birdeye.so/defi/v2/tokens/new_listing", {
      headers: {
        "x-chain": "solana",
        "X-API-KEY": API_KEY,
      },
    });

    const tokens = res.data.data;
    console.log("🟢 New Listings:");
    tokens.slice(0, 5).forEach((token, i) => {
      console.log(`${i + 1}. ${token.name} (${token.symbol})`);
      console.log(`   Address: ${token.address}`);
      console.log(`   Created: ${token.createdTime}\n`);
    });
  } catch (err) {
    console.error("❌ Error fetching new tokens:", err.message);
  }
}

getNewListings();
