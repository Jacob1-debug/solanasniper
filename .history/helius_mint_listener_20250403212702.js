require("dotenv").config();
const axios = require("axios");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58");

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_URL = `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`;

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
const SOL_MINT = "So11111111111111111111111111111111111111112";
const SLIPPAGE = 1;
const BUY_AMOUNT_SOL = 0.2;
const RAYDIUM_PROGRAM = "RVKd61ztZW9GdKzYvY3KzNwMCpxkUeZLj1QnNL7hVRY";
const PRIVATE_KEY = bs58.decode(process.env.PRIVATE_KEY);
const wallet = Keypair.fromSecretKey(PRIVATE_KEY);

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const seenMints = new Set();

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

async function pollForMints() {
  try {
    const res = await axios.post(HELIUS_URL, {
      jsonrpc: "2.0",
      id: 1,
      method: "getSignaturesForAddress",
      params: [TOKEN_PROGRAM, { limit: 50 }],
    });

    const signatures = res.data.result;
    console.log(`\n📦 Polled ${signatures.length} recent token txs...`);

    for (let sig of signatures) {
      const signature = sig.signature;
      if (seenMints.has(signature)) continue;
      seenMints.add(signature);

      console.log(`🔎 Checking tx: ${signature}`);

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
        const tokenAddress = extractTokenFromLogs(logs);
        if (tokenAddress) {
          console.log(`🪙 Minted Token Address: ${tokenAddress}`);
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
        }
      }
    }
  } catch (err) {
    console.error("❌ Error polling Helius:", err.message);
  }
}

console.log("🚨 Helius listener started — scanning for token mints every 40s...");
setInterval(pollForMints, 40000);
