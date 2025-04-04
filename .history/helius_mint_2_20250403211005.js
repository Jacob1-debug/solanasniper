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

function extractTokenFromLogs(logs) {
  for (const log of logs) {
    const match = log.match(/mint: ([A-Za-z0-9]+)/);
    if (match) return match[1];
  }
  return null;
}

async function checkJupiter(tokenAddress) {
  try {
    console.log("🔍 Checking Jupiter for:", tokenAddress);
    const res = await axios.get("https://quote-api.jup.ag/v6/supportedTokens");
    return res.data.tokens.find(t => t.address === tokenAddress);
  } catch (err) {
    console.error("Jupiter API error:", err.message);
    return null;
  }node helius_mint_2.js

}

async function checkRugSafety(tokenAddress) {
  try {
    console.log("🔍 Checking RugCheck for:", tokenAddress);
    const res = await axios.get(`https://api.rugcheck.xyz/tokens/${tokenAddress}`);
    const d = res.data;
    if (d && d.riskScore >= 80 && d.liquidity.sol >= 1) {
      console.log(`🛡️ RugCheck Passed: Risk Score = ${d.riskScore}, Liquidity = ${d.liquidity.sol} SOL`);
      return true;
    } else {
      console.log(`🚩 RugCheck Failed: Risk Score = ${d?.riskScore}, Liquidity = ${d?.liquidity?.sol}`);
      return false;
    }
  } catch (err) {
    console.error("RugCheck API error:", err.message);
    return false;
  }
}

app.post("/webhook", async (req, res) => {
  const data = req.body;
  console.log("\n📥 Incoming Payload:");
  console.dir(data, { depth: null });

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
          console.log("💸 Token passed all checks. Ready to buy (buy function placeholder). ");
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running at http://localhost:${PORT}/webhook`);
});
