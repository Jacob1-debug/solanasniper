require("dotenv").config();
const { Connection, PublicKey } = require("@solana/web3.js");

const HELIUS_RPC = process.env.HELIUS_API_KEY;
const connection = new Connection(`https://rpc.helius.xyz/?api-key=${HELIUS_RPC}`, "confirmed");

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const seenMints = new Set();

console.log("🚨 Real-time Helius listener started — waiting for token mints...");

connection.onLogs(TOKEN_PROGRAM, async (logObj) => {
  try {
    const logs = logObj.logs.join("\n");
    const signature = logObj.signature;

    if (seenMints.has(signature)) return;
    seenMints.add(signature);

    if (logs.includes("initializeMint")) {
      console.log("\n🆕 Detected New Token Mint!");
      console.log(`🔗 https://solscan.io/tx/${signature}`);
    }
  } catch (err) {
    console.error("❌ Error in log listener:", err.message);
  }
});
