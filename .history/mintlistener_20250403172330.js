const { Connection, PublicKey } = require("@solana/web3.js");

const RPC_URL = "https://api.mainnet-beta.solana.com"; // or use Helius RPC key
const connection = new Connection(RPC_URL, "confirmed");

// Token Program ID (standard for mints)
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

console.log("🟡 Listening for new token mints...");

connection.onLogs(TOKEN_PROGRAM_ID, async (log) => {
  const logs = log.logs.join("\n");
  if (logs.includes("initializeMint")) {
    const signature = log.signature;
    console.log(`🆕 New token minted:`);
    console.log(`→ Tx: https://solscan.io/tx/${signature}`);
    const axios = require("axios");

    async function checkJupiter(tokenAddress) {
    try {
        const res = await axios.get("https://quote-api.jup.ag/v6/supportedTokens");
        const supported = res.data;
        const found = supported.tokens.find(t => t.address === tokenAddress);
        return found;
    } catch (err) {
        console.error("🚨 Error checking Jupiter support:", err.message);
        return null;
    }
    }

  }
});
