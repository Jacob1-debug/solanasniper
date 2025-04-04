require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58");
const TelegramBot = require("node-telegram-bot-api");

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const PRIVATE_KEY = bs58.decode(process.env.PRIVATE_KEY);
const wallet = Keypair.fromSecretKey(PRIVATE_KEY);

const SOL_MINT = "So11111111111111111111111111111111111111112";
const SLIPPAGE = 1;
const BUY_AMOUNT_SOL = 0.09;
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

const seenMints = new Set();
const boughtTokens = new Map();
const bot = new TelegramBot(TELEGRAM_TOKEN);

// Buy limit
let hourlyBuyCount = 0;
const BUY_LIMIT = 3;
setInterval(() => {
  hourlyBuyCount = 0;
  console.log("🔄 Buy limit reset.");
}, 60 * 60 * 1000);

if (!fs.existsSync("sniper_log.csv")) {
  fs.writeFileSync("sniper_log.csv", "timestamp,token_address,amount_or_price,status\n");
}

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
      console.log(`🛡️ RugCheck Passed: Score = ${d.riskScore}, Liquidity = ${d.liquidity.sol} SOL`);
      return true;
    } else {
      console.log(`🚩 RugCheck Failed: Score = ${d?.riskScore}, Liquidity = ${d?.liquidity?.sol}`);
      return false;
    }
  } catch (err) {
    console.error("RugCheck error:", err.message);
    return false;
  }
}

async function executeBuy(tokenAddress) {
  try {
    if (hourlyBuyCount >= BUY_LIMIT) {
      console.log("⚠️ Hourly buy limit reached. Skipping.");
      return false;
    }

    const routeRes = await axios.get("https://quote-api.jup.ag/v6/quote", {
      params: {
        inputMint: SOL_MINT,
        outputMint: tokenAddress,
        amount: Math.floor(BUY_AMOUNT_SOL * 1e9),
        slippageBps: SLIPPAGE * 100,
      }
    });

    const route = routeRes.data;
    if (!route || !route.routes || route.routes.length === 0) return false;

    const swapRes = await axios.post("https://quote-api.jup.ag/v6/swap", {
      route: route.routes[0],
      userPublicKey: wallet.publicKey.toBase58(),
      wrapUnwrapSOL: true,
    });

    const tx = Buffer.from(swapRes.data.swapTransaction, "base64");
    const transaction = await connection.deserializeTransaction(tx);
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;

    const signed = await wallet.signTransaction(transaction);
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(sig);

    console.log(`✅ Bought ${tokenAddress}: https://solscan.io/tx/${sig}`);
    fs.appendFileSync("sniper_log.csv", `${new Date().toISOString()},${tokenAddress},${BUY_AMOUNT_SOL},BOUGHT\n`);
    await bot.sendMessage(TELEGRAM_CHAT_ID, `✅ Bought token: ${tokenAddress} for ${BUY_AMOUNT_SOL} SOL`);
    hourlyBuyCount++;
    boughtTokens.set(tokenAddress, { buyPrice: null });
    return true;
  } catch (err) {
    console.error("❌ Buy failed:", err.message);
    return false;
  }
}

async function sellToken(tokenAddress) {
  try {
    const routeRes = await axios.get("https://quote-api.jup.ag/v6/quote", {
      params: {
        inputMint: tokenAddress,
        outputMint: SOL_MINT,
        amount: Math.floor(BUY_AMOUNT_SOL * 1e9),
        slippageBps: SLIPPAGE * 100,
      }
    });

    const route = routeRes.data;
    if (!route || !route.routes || route.routes.length === 0) throw new Error("No sell route found");

    const swapRes = await axios.post("https://quote-api.jup.ag/v6/swap", {
      route: route.routes[0],
      userPublicKey: wallet.publicKey.toBase58(),
      wrapUnwrapSOL: true,
    });

    const tx = Buffer.from(swapRes.data.swapTransaction, "base64");
    const transaction = await connection.deserializeTransaction(tx);
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;

    const signed = await wallet.signTransaction(transaction);
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(sig);

    fs.appendFileSync("sniper_log.csv", `${new Date().toISOString()},${tokenAddress},SELL_EXECUTED,COMPLETED\n`);
    await bot.sendMessage(TELEGRAM_CHAT_ID, `💰 Auto-sold ${tokenAddress} (profit/loss trigger hit)`);
    console.log(`✅ SOLD ${tokenAddress}: https://solscan.io/tx/${sig}`);
  } catch (err) {
    console.error("❌ Sell failed:", err.message);
  }
}

async function trackTokenPerformance(tokenAddress) {
  try {
    const res = await axios.get(`https://public-api.birdeye.so/public/price?address=${tokenAddress}`);
    const price = res.data?.data?.value || 0;
    console.log(`📈 ${tokenAddress} price: $${price}`);

    if (boughtTokens.has(tokenAddress)) {
      const token = boughtTokens.get(tokenAddress);
      if (!token.buyPrice) {
        token.buyPrice = price;
      } else {
        const gain = price / token.buyPrice;
        if (gain >= 1.45) {
          console.log("🚀 1.45x profit target hit.");
          await sellToken(tokenAddress);
          boughtTokens.delete(tokenAddress);
          return;
        }
        if (gain <= 0.7) {
          console.log("⚠️ 0.7x loss trigger hit.");
          await sellToken(tokenAddress);
          boughtTokens.delete(tokenAddress);
          return;
        }
      }
    }

    fs.appendFileSync("sniper_log.csv", `${new Date().toISOString()},${tokenAddress},${price},TRACKED\n`);
  } catch (err) {
    console.error("❌ Tracking error:", err.message);
  }
}

setInterval(async () => {
  for (const token of boughtTokens.keys()) {
    await trackTokenPerformance(token);
  }
}, 10 * 60 * 1000);

console.log("🚨 Sniper bot started. Listening for mints...");

connection.onLogs(new PublicKey(TOKEN_PROGRAM), async (logInfo) => {
  const logs = logInfo.logs.join("\n");
  if (!logs.includes("initializeMint")) return;

  const signature = logInfo.signature;
  if (seenMints.has(signature)) return;
  seenMints.add(signature);

  const tokenAddress = extractTokenFromLogs(logInfo.logs);
  if (!tokenAddress) return;

  const tx = await connection.getTransaction(signature, { commitment: "confirmed" });
  const blockTime = tx?.blockTime;
  const mintAge = Date.now() / 1000 - blockTime;
  if (mintAge < 60) {
    console.log("⏳ Mint too fresh. Skipping.");
    return;
  }

  console.log(`🆕 Mint detected: ${tokenAddress} → https://solscan.io/tx/${signature}`);

  const tradable = await checkJupiter(tokenAddress);
  if (!tradable) return console.log("❌ Not tradable on Jupiter.");

  const safe = await checkRugSafety(tokenAddress);
  if (!safe) return;

  const bought = await executeBuy(tokenAddress);
  if (bought) await trackTokenPerformance(tokenAddress);
});
