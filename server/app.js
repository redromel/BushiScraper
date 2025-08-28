import { chromium } from "playwright";
import Card from "./card.js";
import axios  from "axios";

export async function scrape(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.route("**/*", (route) => {
    const t = route.request().resourceType();
    if (t === "image" || t === "font" || t === "stylesheet" || t === "media")
      return route.abort();
    route.continue();
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForSelector("div.card-container.card-view", {
    timeout: 15000,
  });

  const cards = await page.$$eval("div.card-container.card-view", (nodes) =>
    nodes.map((el) => {
      const card = el.querySelector("img.card-view-item");
      const title = card?.getAttribute("title") || "";

      return title;
    })
  );

 
  await browser.close();

  const card_ids = cards.map((title) => splitTitle(title).code);
  return card_ids;
}

function splitTitle(titleRaw = "") {
  // Split on normal ":" or Japanese "："
  const parts = (titleRaw || "").split(/:|：/);

  const code = parts[0] ? parts[0].trim() : "";
  // join back everything after the first colon
  const name = parts.length > 1 ? parts.slice(1).join(":").trim() : "";

  return { code, name };
}

async function deckBuilder() {
  const cardDb = "https://api.dingdongdb.me/v1/card/json"
  const { data } = await axios.get(cardDb);

  const cards = Object.fromEntries(
    data.map((card) => [card.card_id, card])
  );
  const card = cards["BP10-069EN"]
  return card

}

// function printDeck(deck) {
//   deck.forEach((card) => {
//     const info = card.getCardInfo();
//     console.log(`${info.quantity} ${info.name}`);
//   });
// }

// const deck = await scrape("https://decklog.bushiroad.com/view/1BP89");
// const deck = await scrape("https://decklog-en.bushiroad.com/view/3YB14");
const deck = await deckBuilder();
console.log(deck);
