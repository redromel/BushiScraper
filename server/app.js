import { getOtherLangDeck } from "./deck.js";
import { createDecklist } from "./deck_creator.js";
import { scrapeBushi } from "./scraper.js";
import fs from "fs/promises"
const rawDeck = await scrapeBushi("https://decklog.bushiroad.com/view/1UD7X");

const enDeck = await getOtherLangDeck(rawDeck);

console.log(enDeck);
// await fs.writeFile("data/testing.json", JSON.stringify(enDeck,null,2),"utf-8");
await createDecklist(enDeck);
