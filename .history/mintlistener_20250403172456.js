require("dotenv").config();
const { Connection, PublicKey } = require("@solana/web3.js");
const axios = require("axios");

// RPC connection (you can use a Helius key later)
const RPC_URL = "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

// Solana Token Program
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

console.log("🟡 Listening for new token mints...");

// Listen for logs from the Token Program
connection.onLogs(TOKEN_PROGRAM_ID, async (logInfo) => {
  const logs = logInfo.logs.join("\n");

  if (logs.includes("initializeMint")) {
    const txSignature = logInfo.signature;
    console.log(`🆕 New token mint detected`);
    console.log(`→ Tx: https://solscan.io/tx/${txSignature}`);

    // --- TEMP: Manually set token address for now ---
    const tokenAddress = "TOKEN_ADDRESS_HERE"; // <- replace this with a real one to test liquidity check

    // --- Jupiter Liquidity Check ---
    const isTradable = await checkJupiter(tokenAddress);

    if (isTradable) {
      console.log(`✅ ${isTradable.symbol} is tradable!`);
      console.log(`→ Address: ${isTradable.address}`);
      console.log(`💥 Ready to snipe this token`);
    } else {
      console.log("❌ Token not swappable on Jupiter yet. Skipping...");
    }

    console.log("--------------------------------------------------\n");
  }
});

// Check if token is supported on Jupiter (meaning: has liquidity)
async function checkJupiter(tokenAddress) {
  try {
    const res = await axios.get("https://quote-api.jup.ag/v6/supportedTokens");
    const supported = res.data.tokens;

    const token = supported.find(t => t.address === tokenAddress);
    return token || null;
  } catch (err) {
    console.error("🚨 Jupiter check failed:", err.message);
    return null;
  }
}
