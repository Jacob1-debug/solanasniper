require("dotenv").config();
const puppeteer = require("puppeteer");
const { Connection, Keypair } = require("@solana/web3.js");
const bs58 = require("bs58");
const axios = require("axios");

const RPC_URL = "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC_URL, "confirmed");
const wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
const SOL_MINT = "So11111111111111111111111111111111111111112";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const BUY_AMOUNT_SOL = 0.2;
const SLIPPAGE = 1;

async function fetchTrendingTokens() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://birdeye.so/token-trending?chain=solana", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await delay(8000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  await delay(8000);

  const tokens = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("a[href^='/token/']"));
    return rows.slice(0, 10).map(row => {
      const name = row.querySelector("h6")?.textContent.trim();
      const symbol = row.querySelector("p")?.textContent.trim();
      const href = row.getAttribute("href");
      const address = href?.split("/token/")[1];
      return { name, symbol, address };
    });
  });

  await browser.close();
  return tokens.filter(t => t.name && t.symbol && t.address);
}

async function checkJupiter(tokenAddress) {
  try {
    const res = await axios.get("https://quote-api.jup.ag/v6/supportedTokens");
    const token = res.data.tokens.find(t => t.address === tokenAddress);
    return token || null;
  } catch (err) {
    console.error("🚨 Jupiter check failed:", err.message);
    return null;
  }
}

async function checkRugSafety(tokenAddress) {
  try {
    const res = await axios.get(`https://api.rugcheck.xyz/tokens/${tokenAddress}`);
    const d = res.data;
    if (d && d.riskScore >= 80 && d.liquidity.sol >= 1) {
      console.log(`🛡️ Risk Score: ${d.riskScore}, Liquidity: ${d.liquidity.sol} SOL`);
      return true;
    } else {
      console.log(`🚩 Risk Score: ${d.riskScore}, Liquidity: ${d.liquidity.sol} SOL`);
      return false;
    }
  } catch (err) {
    console.error("⚠️ RugCheck error:", err.message);
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
    if (!route) return console.log("❌ No route to token");

    const swapRes = await axios.post("https://quote-api.jup.ag/v6/swap", {
      route,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapUnwrapSOL: true,
      feeAccount: null,
    });

    const txBuf = Buffer.from(swapRes.data.swapTransaction, "base64");
    const signedTx = await wallet.signTransaction(await connection.deserializeTransaction(txBuf));
    const txid = await connection.sendRawTransaction(signedTx.serialize());

    console.log(`🚀 Bought token! Tx: https://solscan.io/tx/${txid}`);
  } catch (err) {
    console.error("❌ Swap failed:", err.message || err);
  }
}

async function runSniper() {
  console.log("🎯 Starting sniper bot...");

  const tokens = await fetchTrendingTokens();
  console.log(`📦 Found ${tokens.length} tokens from Birdeye`);
if (tokens.length === 0) {
  console.log("⚠️ No tokens found — check scraping or page structure.");
  return;
}


  for (const token of tokens) {
    console.log(`\n🔎 Token: ${token.name} (${token.symbol})`);
    console.log(`🔗 Address: ${token.address}`);

    const tradable = await checkJupiter(token.address);
    if (!tradable) {
      console.log("❌ Not tradable on Jupiter. Skipping...");
      continue;
    } else {
      console.log(`✅ Tradable on Jupiter! (${tradable.symbol})`);
    }

    const safe = await checkRugSafety(token.address);
    if (!safe) {
      console.log("🚩 Failed RugCheck. Skipping...");
      continue;
    } else {
      console.log("✅ Passed RugCheck ✅");
    }

    console.log(`🚀 Buying token: ${token.symbol} (${token.address})`);
    await buyToken(token.address);
    break;
  }

  console.log("🔁 Sniper cycle complete.\n");
}

setInterval(runSniper, 1000 * 60 * 5); // Run every 5 minutes
runSniper(); // Initial run
