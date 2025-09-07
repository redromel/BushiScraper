import { chromium } from "playwright";
import Card from "./card.js";
import { getOtherLangDeck, validateDeck } from "./deck.js";
import fs from "fs/promises"


/**
 * Scrapes a Bushiroad decklist page for card data.
 *
 * - Launches a headless Chromium browser (via Playwright/Puppeteer API).
 * - Blocks unnecessary resource types (images, fonts, stylesheets, media) for speed.
 * - Navigates to the given URL and waits for deck card containers to load.
 * - Extracts each card’s `title` (containing code + name) and quantity.
 * - Converts raw data into `Card` objects using `splitTitle` to separate code and name.
 *
 * @async
 * @param {string} url - The Bushiroad decklist URL to scrape.
 * @returns {Promise<Card[]>} A promise resolving to an array of `Card` objects with `card_name`, `card_id`, and `quantity`.
 */
export async function scrapeBushi(url) {
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
      const quantity =
        Number(el.querySelector("span.num")?.textContent.trim()) || 1;

      return { title, quantity };
    })
  );

  await browser.close();

  const deck = cards.map(({ title, quantity }) => {
    const { code, name } = splitTitle(title);

    return new Card({
      card_name: name,
      card_id: code,
      quantity: quantity,
    });
  });

  return deck;
}

function splitTitle(titleRaw = "") {
  // Split on normal ":" or Japanese "："
  const parts = (titleRaw || "").split(/:|：/);

  const code = parts[0] ? parts[0].trim() : "";
  // join back everything after the first colon
  const name = parts.length > 1 ? parts.slice(1).join(":").trim() : "";

  return { code, name };
}

// const rawDeck = await scrapeBushi("https://decklog.bushiroad.com/view/3EXPH");


// const enDeck = getOtherLangDeck(rawDeck)

// await fs.writeFile("data/testDeck.json", JSON.stringify(enDeck,null,2),"utf-8");



