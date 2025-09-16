import { getOtherLangDeck } from "./deck.js";
import { createDecklist } from "../services/deck_creator.js";
import { getBushiDeck } from "../services/scraper.js";


const args = process.argv.slice(2);

let url = null;
args.forEach((arg, idx) => {
  if (arg === "--url" && args[idx + 1]) {
    url = args[idx + 1];
  }
});

if (!url) {
  console.error("Missing required --url argument");
  process.exit(1);
}


console.log(`Generating EN Bushiroad link for ${url}`);
const rawDeck = await getBushiDeck(`${url}`);
const enDeck = await getOtherLangDeck(rawDeck);
await createDecklist(enDeck);
