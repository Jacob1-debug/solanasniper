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
  }
});
