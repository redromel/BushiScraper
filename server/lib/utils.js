import axios from "axios";
import fs from "fs/promises";
import { syncAltIds } from "../services/id_syncer.js";
import { compareDecks, getDeckInfoFromId } from "../cards/deck.js";
import { getBushiDeck } from "../services/scraper.js";
import { mergeDatabases } from "../services/database_merger.js"
import { matchJpAndEn } from "../services/linker.js";
import { runManualReview } from "../services/review.js";

async function getDatabase(url, filePath = "../data/cards.json") {
  const { data: cardsData } = await axios.get(url);
  await fs.writeFile(filePath, JSON.stringify(cardsData, null, 2), "utf-8");
}

async function syncDatabase() {
  const cardList = await fs.readFile("../data/synced_cards.json", "utf-8");
  const newCardList = await syncAltIds(JSON.parse(cardList));
  await fs.writeFile(
    "../data/synced_cards.json",
    JSON.stringify(newCardList, null, 2),
    "utf-8"
  );
}
async function mergeAndSync() {
  const oldDb = await fs.readFile("../data/synced_cards.json", "utf-8");
  const newDb = await fs.readFile("../data/set11_cards.json", "utf-8");

  const oldCardlist = JSON.parse(oldDb)
  const newCardlist = JSON.parse(newDb)

  const mergedDb = mergeDatabases(oldCardlist, newCardlist);
  const {reviewedDb, cardReview} = matchJpAndEn(mergedDb);
  const {database, rejectedList} = await runManualReview(reviewedDb, cardReview);
  const newCardList = await syncAltIds(database);
  await fs.writeFile(
    "../data/synced_cards_2.json",
    JSON.stringify(newCardList, null, 2),
    "utf-8"
  );


}

await mergeAndSync()
// await syncDatabase()

// const {deck: deckARaw} = await getBushiDeck("https://decklog-en.bushiroad.com/view/2U46Y")
// const {deck: deckBRaw} = await getBushiDeck("https://decklog-en.bushiroad.com/view/6EYGL")

// const deckA = await getDeckInfoFromId(deckARaw);
// const deckB = await getDeckInfoFromId(deckBRaw);

// const {same, removed, changed, added} = await compareDecks(deckA, deckB)
// console.log("same", same)
// console.log("remoevd", removed)
// console.log("changed", changed)
// console.log("added", added)
