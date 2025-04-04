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
  } else if (logs.some(log => log.includes("initialize2") && log.includes(RAYDIUM_PROGRAM))) {
    console.log("\n💧 Detected Raydium Liquidity Event!");
    console.log(`🔗 https://solscan.io/tx/${signature}`);

    const tokenAddress = extractTokenFromLogs(logs);
    if (tokenAddress) {
      console.log("🧠 Checking if tradable on Jupiter:");
      const tradable = await checkJupiter(tokenAddress);
      if (tradable) {
        console.log(`✅ Tradable token found: ${tradable.symbol}`);
        await buyToken(tokenAddress);
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

function extractTokenFromLogs(logs) {
  for (const log of logs) {
    const match = log.match(/mint: ([A-Za-z0-9]+)/);
    if (match) return match[1];
  }
  return null;
}

async function checkJupiter(tokenAddress) {
  try {
    const res = await axios.get("https://quote-api.jup.ag/v6/supportedTokens");
    return res.data.tokens.find(t => t.address === tokenAddress);
  } catch (err) {
    console.error("Jupiter API error:", err.message);
    return null;
  }
}

async function buyToken(tokenAddress) {
  try {
    const quote = await axios.get("https://quote-api.jup.ag/v6/quote", {
      params: {
        inputMint: SOL_MINT,
        outputMint: tokenAddress,
        amount: Math.floor(BUY_AMOUNT_SOL * 1e9),
        slippageBps: SLIPPAGE * 100,
      },
    });

    const route = quote.data?.routes?.[0];
    if (!route) return console.log("❌ No route available.");

    const swap = await axios.post("https://quote-api.jup.ag/v6/swap", {
      route,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapUnwrapSOL: true,
      feeAccount: null,
    });

    const txBuf = Buffer.from(swap.data.swapTransaction, "base64");
    const tx = await connection.deserializeTransaction(txBuf);
    const signed = await wallet.signTransaction(tx);
    const txid = await connection.sendRawTransaction(signed.serialize());

    console.log(`🚀 Bought token! Tx: https://solscan.io/tx/${txid}`);
  } catch (err) {
    console.error("Buy error:", err.message || err);
  }
}

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running at http://localhost:${PORT}/webhook`);
});
