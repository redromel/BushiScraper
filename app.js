import { chromium } from "playwright";
import * as cheerio from "cheerio";
import Card from "./card.js";

async function scrape(url) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("div.card-container.card-view");

  const html = await page.content();
  await browser.close();

  const $ = cheerio.load(html);
  const cards = $("div.card-container.card-view")
    .map((_, el) => {
      const $img = $(el).find("img.card-view-item");
      const title = $img.attr("title") || "";
      const img = $img.attr("data-src") || "";
      const alt = $img.attr("alt") || "";
      const qnt = Number($(el).find("span.num").text().trim()) || 1;
      const { code, name } = splitTitle(title);

      return new Card(code, name, img, alt, qnt);
    })
    .get();

  return cards;
}

function splitTitle(titleRaw = "") {
  // Split on normal ":" or Japanese "："
  const parts = (titleRaw || "").split(/:|：/);

  const code = parts[0] ? parts[0].trim() : "";
  // join back everything after the first colon
  const name = parts.length > 1 ? parts.slice(1).join(":").trim() : "";

  return { code, name };
}

function printDeck(deck) {
  deck.forEach((card) => {
    const info = card.getCardInfo();
    console.log(
      `${info.quantity} ${info.name}`
    );
  });
}

// const deck = await scrape("https://decklog.bushiroad.com/view/1BP89");
const deck = await scrape("https://decklog-en.bushiroad.com/view/3YB14");
printDeck(deck);