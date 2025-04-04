const puppeteer = require("puppeteer");

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // ✅ CORRECT trending URL
  await page.goto("https://birdeye.so/token-trending?chain=solana", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // Let content load fully
  await delay(5000);

  // Scroll to force token list to load
  await page.evaluate(() => {
    window.scrollBy(0, 3000);
  });

  await delay(4000);

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
  if (tokens.length === 0) {
    console.log("⚠️ No tokens found. Try increasing scroll or delay.");
  }

  tokens.forEach((t, i) => {
    console.log(`${i + 1}. ${t.name} (${t.symbol})`);
    console.log(`   Address: ${t.address}`);
    console.log(`   Link: ${t.link}\n`);
  });

  await browser.close();
})();
