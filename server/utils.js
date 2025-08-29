import axios from "axios";
import fs from "fs/promises";

async function getDatabase(url, filePath = "./cards.json") {
  const { data: cardsData } = await axios.get(url);
  await fs.writeFile(filePath, JSON.stringify(cardsData, null, 2), "utf-8");
}