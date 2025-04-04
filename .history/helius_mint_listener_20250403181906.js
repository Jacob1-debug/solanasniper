require("dotenv").config();
const axios = require("axios");

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_URL = `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`;

// Solana Token Program
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

// Set of already seen mints to prevent duplicates
const seenMints = new Set();

async function pollForMints() {
  try {
    const res = await axios.post(HELIUS_URL, {
      jsonrpc: "2.0",
      id: 1,
      method: "getSignaturesForAddress",
      params: [TOKEN_PROGRAM, { limit: 20 }],
    });

    const signatures = res.data.result;

    for (let sig of signatures) {
      const signature = sig.signature;
      if (seenMints.has(signature)) continue;
      seenMints.add(signature);

      const txDetails = await axios.post(HELIUS_URL, {
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [signature, { encoding: "jsonParsed" }],
      });

      const logs = txDetails?.data?.result?.meta?.logMessages || [];

      const isMint = logs.some(log => log.includes("initializeMint"));
      if (isMint) {
        console.log("\n🆕 Detected New Token Mint!");
        console.log(`🔗 https://solscan.io/tx/${signature}`);
      }
    }
  } catch (err) {
    console.error("❌ Error polling Helius:", err.message);
  }
}

console.log("🚨 Helius listener started — scanning for token mints every 0s...");
setInterval(pollForMints, 50000);
