require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58");

const app = express();
app.use(bodyParser.json());

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
const SOL_MINT = "So11111111111111111111111111111111111111112";
const SLIPPAGE = 1;
const BUY_AMOUNT_SOL = 0.2;
const RAYDIUM_PROGRAM = "RVKd61ztZW9GdKzYvY3KzNwMCpxkUeZLj1QnNL7hVRY"; // Raydium AMM
const PRIVATE_KEY = bs58.decode(process.env.PRIVATE_KEY);
const wallet = Keypair.fromSecretKey(PRIVATE_KEY);

app.post("/webhook", async (req, res) => {
  const data = req.body;
  const logs = data?.logs || [];
  const signature = data?.signature || "unknown";

  if (logs.some(log => log.includes("initializeMint"))) {
    console.log("\n🆕 New Token Mint Detected!");
    console.log(`🔗 https://solscan.io/tx/${signature}`);
    const tokenAddress = extractTokenFromLogs(logs);
    if (tokenAddress) {
      console.log(`🪙 Minted Token Address: ${tokenAddress}`);
    }
  } else if (logs.some(log => log.includes("initialize2") && log.includes(RAYDIUM_PROGRAM))) {
    console.log("\n💧 Detected Raydium Liquidity Event!");
    console.log(`🔗 https://solscan.io/tx/${signature}`);

    const tokenAddress = extractTokenFromLogs(logs);
    if (tokenAddress) {
      console.log(`🪙 Token Address: ${tokenAddress}`);
      const tradable = await checkJupiter(tokenAddress);
      if (tradable) {
        console.log(`✅ Tradable token found: ${tradable.symbol}`);
        const safe = await checkRugSafety(tokenAddress);
        if (safe) {
          await buyToken(tokenAddress);
        } else {
          console.log("🚩 Token failed RugCheck or liquidity filter.");
        }
      } else {
        console.log("❌ Token not tradable yet on Jupiter.");
      }
    } else {
      console.log("⚠️ Could not extract token address from logs.");
    }
  } else {
    console.log("⚠️ Received tx with no initializeMint or Raydium event.");
  }

  res.sendStatus(200);
});

// ... rest of the unchanged functions

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running at http://localhost:${PORT}/webhook`);
});
