require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

app.post("/webhook", async (req, res) => {
  const data = req.body;

  const logs = data?.logs || [];
  const signature = data?.signature || "unknown";

  if (logs.some(log => log.includes("initializeMint"))) {
    console.log("\n🆕 New Token Mint Detected!");
    console.log(`🔗 https://solscan.io/tx/${signature}`);
  } else {
    console.log("⚠️ Received tx with no initializeMint.");
  }

  res.sendStatus(200);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running at http://localhost:${PORT}/webhook`);
});
