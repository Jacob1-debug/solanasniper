require("dotenv").config();
const axios = require("axios");

const API_KEY = process.env.BIRDEYE_API_KEY;

if (!API_KEY) {
  console.error("❌ Missing API key in .env");
  process.exit(1);
}

async function getTrendingTokens() {
  try {
    const res = await axios.get("https://public-api.birdeye.so/defi/token_trending", {
      headers: {
        "X-API-KEY": API_KEY,
        "x-chain": "solana",
      },
    });

    const tokens = res.data.data;

    if (!tokens || tokens.length === 0) {
      console.log("⚠️ No trending tokens found.");
      return;
    }

    console.log("🔥 Trending Tokens:");
    tokens.slice(0, 5).forEach((token, i) => {
      console.log(`${i + 1}. ${token.name} (${token.symbol})`);
      console.log(`   Address: ${token.address}`);
      console.log(`   1h Volume: ${token.volume1h} SOL`);
      console.log(`   Price: ${token.price}`);
      console.log(`   Age: ${token.age} \n`);
    });
  } catch (err) {
    console.error("❌ API request failed:", err.response?.data || err.message);
  }
}

getTrendingTokens();
