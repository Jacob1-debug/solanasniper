require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58");
const TelegramBot = require("node-telegram-bot-api");

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const HELIUS_URL = `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`;

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
const SOL_MINT = "So11111111111111111111111111111111111111112";
const SLIPPAGE = 1;
const BUY_AMOUNT_SOL = 0.2;
const PRIVATE_KEY = bs58.decode(process.env.PRIVATE_KEY);
const wallet = Keypair.fromSecretKey(PRIVATE_KEY);

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const seenMints = new Set();
const boughtTokens = new Map();

const bot = new TelegramBot(TELEGRAM_TOKEN);

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
  }
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

async function executeBuy(tokenAddress) {
  try {
    console.log(`🚀 Executing real buy for ${tokenAddress} with ${BUY_AMOUNT_SOL} SOL`);
    const routeRes = await axios.get("https://quote-api.jup.ag/v6/quote", {
      params: {
        inputMint: SOL_MINT,
        outputMint: tokenAddress,
        amount: Math.floor(BUY_AMOUNT_SOL * 1e9),
        slippageBps: SLIPPAGE * 100,
      }
    });

    const route = routeRes.data;
    if (!route || !route.routes || route.routes.length === 0) throw new Error("No route found");

    const swapRes = await axios.post("https://quote-api.jup.ag/v6/swap", {
      route: route.routes[0],
      userPublicKey: wallet.publicKey.toBase58(),
      wrapUnwrapSOL: true,
      feeAccount: null
    });

    const tx = swapRes.data.swapTransaction;
    const swapTx = Buffer.from(tx, "base64");
    const transaction = await connection.deserializeTransaction(swapTx);
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;
    const signed = await wallet.signTransaction(transaction);
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(sig);

    const row = `${new Date().toISOString()},${tokenAddress},${BUY_AMOUNT_SOL},BOUGHT
`;
    fs.appendFileSync("sniper_log.csv", row, "utf8");

    await bot.sendMessage(TELEGRAM_CHAT_ID, `✅ Bought token: ${tokenAddress} for ${BUY_AMOUNT_SOL} SOL`);
    boughtTokens.set(tokenAddress, { buyPrice: null });
    return true;
  } catch (err) {
    console.error("❌ Buy failed:", err.message);
    return false;
  }
}

async function trackTokenPerformance(tokenAddress) {
  try {
    const res = await axios.get(`https://public-api.birdeye.so/public/price?address=${tokenAddress}`);
    const price = res.data?.data?.value || 0;
    console.log(`📈 Current price of token ${tokenAddress}: $${price}`);

    if (boughtTokens.has(tokenAddress)) {
      const token = boughtTokens.get(tokenAddress);
      if (!token.buyPrice) {
        token.buyPrice = price;
      } else if (price >= token.buyPrice * 1.45) {
        const row = `${new Date().toISOString()},${tokenAddress},${price},TARGET_HIT
`;
        fs.appendFileSync("sniper_log.csv", row, "utf8");
        await bot.sendMessage(TELEGRAM_CHAT_ID, `📈 ${tokenAddress} hit 1.45x target! Consider selling!`);
        boughtTokens.delete(tokenAddress);
      }
    }

    const row = `${new Date().toISOString()},${tokenAddress},${price},TRACKED
`;
    fs.appendFileSync("sniper_log.csv", row, "utf8");
  } catch (err) {
    console.error("❌ Price tracking failed:", err.message);
  }
}

setInterval(async () => {
  for (const token of boughtTokens.keys()) {
    await trackTokenPerformance(token);
  }
}, 10 * 60 * 1000);

if (!fs.existsSync("sniper_log.csv")) {
  fs.writeFileSync("sniper_log.csv", "timestamp,token_address,amount_or_price,status\n");
}

console.log("🚨 Solana log listener started — watching for token mints in real time...");

connection.onLogs(new PublicKey(TOKEN_PROGRAM), async (logInfo) => {
  console.log("🟢 Received logs for transaction:", logInfo.signature);
  const logs = logInfo.logs.join("\n");

  if (logs.includes("initializeMint")) {
    const signature = logInfo.signature;
    if (seenMints.has(signature)) return;
    seenMints.add(signature);

    console.log("\n🆕 Detected New Token Mint (via onLogs)!");
    console.log(`🔗 https://solscan.io/tx/${signature}`);

    const tokenAddress = extractTokenFromLogs(logInfo.logs);
    if (tokenAddress) {
      console.log(`🪙 Minted Token Address: ${tokenAddress}`);
      const tradable = await checkJupiter(tokenAddress);
      if (tradable) {
        console.log(`✅ Tradable token found: ${tradable.symbol}`);
        const safe = await checkRugSafety(tokenAddress);
        if (safe) {
          const success = await executeBuy(tokenAddress);
          if (success) {
            console.log("💸 Token bought successfully. Tracking performance...");
            await trackTokenPerformance(tokenAddress);
          }
        } else {
          console.log("🚩 Token failed RugCheck or liquidity filter.");
        }
      } else {
        console.log("❌ Token not tradable yet on Jupiter.");
      }
    }
  }
});
