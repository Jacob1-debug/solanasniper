const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("https://birdeye.so/token-trending?chain=solana", {
    waitUntil: "networkidle0",
  });

  // Wait for trending list container
  await page.waitForSelector("a[href^='/token/']");

  // Scroll to load more items (optional)
  await page.evaluate(() => {
    window.scrollBy(0, 1000);
  });

  // Give some time for items to load
  await page.waitForTimeout(2000);

  const tokens = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("a[href^='/token/']"));
    const seen = new Set();
    const tokenData = [];

    for (const row of rows) {
      const name = row.querySelector("h6")?.textContent.trim();
      const symbol = row.querySelector("p")?.textContent.trim();
      const href = row.getAttribute("href");
      const address = href?.split("/token/")[1];

      if (name && symbol && address && !seen.has(address)) {
        seen.add(address);
        tokenData.push({
          name,
          symbol,
          address,
          link: "https://birdeye.so" + href,
        });
      }

      if (tokenData.length >= 10) break;
    }

    return tokenData;
  });

  console.log("🔥 Trending Tokens:");
  tokens.forEach((t, i) => {
    console.log(`${i + 1}. ${t.name} (${t.symbol})`);
    console.log(`   Address: ${t.address}`);
    console.log(`   Link: ${t.link}\n`);
  });

  await browser.close();
})();
