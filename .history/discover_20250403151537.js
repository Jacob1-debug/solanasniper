

const axios = require("axios");

async function getNewTokens() {
  try {
    const res = await axios.get("h", {
      headers: {
        "x-chain": "solana",
      },
    });

    const tokens = res.data.data.tokens;

    // Get tokens launched in the last hour
    const recent = tokens.filter(token => {
      const ageMins = parseInt(token.age.replace("m", ""));
      return ageMins < 60 && token.liquidity?.base > 0.3; // only tokens with some liquidity
    });

    console.log("🟢 Recently launched tokens:");
    recent.slice(0, 5).forEach((token, i) => {
      console.log(`${i + 1}. ${token.name} (${token.symbol})`);
      console.log(`   Liquidity: ${token.liquidity.base} SOL`);
      console.log(`   Price: ${token.price}`);
      console.log(`   Address: ${token.address}\n`);
    });
  } catch (err) {
    console.error("Error fetching tokens:", err.message);
  }
}

getNewTokens();
