require("dotenv").config();
const { Connection, Keypair } = require("@solana/web3.js");
const bs58 = require("bs58");

const secret = bs58.decode(process.env.PRIVATE_KEY);
const keypair = Keypair.fromSecretKey(secret);
const connection = new Connection(process.env.RPC_URL, "confirmed");

(async () => {
  const balance = await connection.getBalance(keypair.publicKey);
  console.log("Your Wallet:", keypair.publicKey.toBase58());
  console.log("Balance:", balance / 1e9, "SOL");
})();
