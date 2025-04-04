const axios = require("axios");
const cheerio = require("cheerio");

const BIRDEYE_URL = "https://www.birdeye.so/find-gems?chain=solana";

async function scrapeTrendingTokens() {
  try {
    const res = await axios.get(BIRDEYE_URL);
    const $ = cheerio.load(res.data);

    const trending = [];

    $("a[href^='/token/']").each((i, el) => {
      const name = $(el).find("h6").text().trim();
      const symbol = $(el).find("p").first().text().trim();
      const tokenLink = "https://birdeye.so" + $(el).attr("href");
      if (name && symbol) {
        trending.push({ name, symbol, link: tokenLink });
      }
    });

    console.log("🔥 Scraped Trending Tokens:");
    trending.slice(0, 5).forEach((t, i) => {
      console.log(`${i + 1}. ${t.name} (${t.symbol})`);
      console.log(`   Link: ${t.link}\n`);
    });
  } catch (err) {
    console.error("❌ Scraping failed:", err.message);
  }
}

scrapeTrendingTokens();
