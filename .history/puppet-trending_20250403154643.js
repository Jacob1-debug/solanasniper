const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: false }); // ← See browser for debugging
  const page = await browser.newPage();

  await page.goto("https://birdeye.so/token-trending?chain=solana", {
    waitUntil: "domcontentloaded",
    timeout: 60000, // ← Increased timeout
  });

  await page.waitForTimeout(5000); // let the DOM fully load

  const tokens = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("a[href^='/token/']"));
    const data = [];

    for (const row of rows) {
      const name = row.querySelector("h6")?.textContent.trim();
      const symbol = row.querySelector("p")?.textContent.trim();
      const href = row.getAttribute("href");
      const address = href?.split("/token/")[1];

      if (name && symbol && address) {
        data.push({
          name,
          symbol,
          address,
          link: "https://birdeye.so" + href,
        });
      }

      if (data.length >= 10) break;
    }

    return data;
  });

  console.log("🔥 Trending Tokens:");
  tokens.forEach((t, i) => {
    console.log(`${i + 1}. ${t.name} (${t.symbol})`);
    console.log(`   Address: ${t.address}`);
    console.log(`   Link: ${t.link}\n`);
  });

  await browser.close();
})();
