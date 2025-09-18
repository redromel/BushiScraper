import axios from "axios";
import fs from "fs/promises";
import { syncAltIds } from "../services/id_syncer.js";


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
