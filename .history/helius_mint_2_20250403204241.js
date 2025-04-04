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

async function checkRugSafety(tokenAddress) {
  try {
    const res = await axios.get(`https://api.rugcheck.xyz/tokens/${tokenAddress}`);
    const d = res.data;
    if (d && d.riskScore >= 80 && d.liquidity.sol >= 1) {
      console.log(`🛡️ RugCheck Passed: Risk Score = ${d.riskScore}, Liquidity = ${d.liquidity.sol} SOL`);
      return true;
    } else {
      console.log(`🚩 RugCheck Failed: Risk Score = ${d.riskScore}, Liquidity = ${d.liquidity.sol} SOL`);
      return false;
    }
  } catch (err) {
    console.error("RugCheck API error:", err.message);
    return false;
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

    // Optional: setup a timer to check price later for auto-sell
    setTimeout(() => autoSell(tokenAddress), 3 * 60 * 1000); // check after 3 mins
  } catch (err) {
    console.error("Buy error:", err.message || err);
  }
}

async function autoSell(tokenAddress) {
  try {
    const balanceRes = await connection.getTokenAccountsByOwner(wallet.publicKey, {
      mint: new PublicKey(tokenAddress)
    });

    const tokenAccount = balanceRes.value[0];
    if (!tokenAccount) return console.log("💤 No token balance to sell.");

    const balanceInfo = await connection.getTokenAccountBalance(tokenAccount.pubkey);
    const amount = parseInt(balanceInfo.value.amount);
    if (amount <= 0) return console.log("💤 No token balance to sell.");

    const quote = await axios.get("https://quote-api.jup.ag/v6/quote", {
      params: {
        inputMint: tokenAddress,
        outputMint: SOL_MINT,
        amount,
        slippageBps: SLIPPAGE * 100,
      },
    });

    const output = quote.data.routes?.[0]?.outAmount;
    if (!output) return console.log("❌ No sell route.");

    const original = BUY_AMOUNT_SOL * 1e9;
    if (parseInt(output) > 2 * original) {
      console.log("📈 Profit reached! Auto-selling...");
      const swap = await axios.post("https://quote-api.jup.ag/v6/swap", {
        route: quote.data.routes[0],
        userPublicKey: wallet.publicKey.toBase58(),
        wrapUnwrapSOL: true,
        feeAccount: null,
      });

      const txBuf = Buffer.from(swap.data.swapTransaction, "base64");
      const tx = await connection.deserializeTransaction(txBuf);
      const signed = await wallet.signTransaction(tx);
      const txid = await connection.sendRawTransaction(signed.serialize());
      console.log(`💸 Sold! Tx: https://solscan.io/tx/${txid}`);
    } else {
      console.log("❌ Not enough profit to sell yet.");
    }
  } catch (err) {
    console.error("Auto-sell error:", err.message);
  }
}

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running at http://localhost:${PORT}/webhook`);
});
