const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://birdeye.so/token-trending?chain=solana", {
    waitUntil: "networkidle0",
  });

  const tokens = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("a[href^='/token/']"));
    const data = rows.slice(0, 10).map(row => {
      const name = row.querySelector("h6")?.textContent.trim();
      const symbol = row.querySelector("p")?.textContent.trim();
      const address = row.getAttribute("href").split("/token/")[1];
      return { name, symbol, address };
    });
    return data;
  });

  console.log("🔥 Top Trending Tokens:");
  tokens.forEach((token, i) => {
    console.log(`${i + 1}. ${token.name} (${token.symbol})`);
    console.log(`   Address: ${token.address}`);
    console.log(`   Link: https://birdeye.so/token/${token.address}\n`);
  });

  await browser.close();
})();
