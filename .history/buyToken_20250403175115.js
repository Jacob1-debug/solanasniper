require("dotenv").config();
const { Connection, Keypair, PublicKey, clusterApiUrl } = require("@solana/web3.js");
const bs58 = require("bs58");
const axios = require("axios");

const RPC_URL = "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

const secretKey = bs58.decode(process.env.PRIVATE_KEY);
const wallet = Keypair.fromSecretKey(secretKey);
const SOL_MINT = "So11111111111111111111111111111111111111112";

// ========== CONFIG ========== //
const buyAmountInSOL = 0.0;
const slippage = 1; // 1% slippage
const tokenToBuy = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"; // ← Replace with target token
// ============================ //

async function buyToken() {
  try {
    console.log("💸 Getting Jupiter quote...");

    const quote = await axios.get("https://quote-api.jup.ag/v6/quote", {
      params: {
        inputMint: SOL_MINT,
        outputMint: tokenToBuy,
        amount: Math.floor(buyAmountInSOL * 1e9), // amount in lamports
        slippageBps: slippage * 100,
      },
    });

    const route = quote.data;
    if (!route || !route.routes || !route.routes.length) {
      console.log("❌ No route available.");
      return;
    }

    const selectedRoute = route.routes[0];

    console.log("✅ Route found. Getting swap transaction...");
    const swapRes = await axios.post("https://quote-api.jup.ag/v6/swap", {
      route: selectedRoute,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapUnwrapSOL: true,
      feeAccount: null,
    });

    const { swapTransaction } = swapRes.data;
    const txBuf = Buffer.from(swapTransaction, "base64");
    const signed = await wallet.signTransaction(await connection.deserializeTransaction(txBuf));
    const txid = await connection.sendRawTransaction(signed.serialize());

    console.log(`🚀 Swap sent! TX: https://solscan.io/tx/${txid}`);
  } catch (err) {
    console.error("❌ Swap failed:", err.message || err);
  }
}

buyToken();
