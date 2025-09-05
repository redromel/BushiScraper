import fs from "fs";
import Card from "./card";

/**
 * Converts a deck into a printable text format.
 * - Skips leader cards.
 * - Adds a blank line before the first evolved card section.
 * - Uses each card’s `printCard()` method for formatting.
 *
 * @param {Card[]} deck - The array of card objects to print.
 * @returns {string} A decklist string without leader cards and with "(Evolved)" text stripped.
 */
export function printDeck(deck) {
  let evoFlag = false;
  let lines = [];
  for (const card of deck) {
    if (
      card.card_type.includes("リーダー") ||
      card.card_type.includes("Leader")
    ) {
      continue;
    }

    if (
      deck[deck.indexOf(card)].card_type.includes("Evolved") &&
      evoFlag === false
    ) {
      evoFlag = true;
      lines.push("");
    }

    lines.push(card.printCard());
  }
  const printedDeck = lines.join("\n");

  return printedDeck;
}

/**
 * Writes a decklist to a file in text format.
 *
 * @param {Card[]} deck - The array of card objects to write.
 * @param {string} [filePath="./decklist.txt"] - Path where the decklist will be written.
 * @returns {string} The file path that the decklist was written to.
 */
export function writeDeckToFile(deck, filePath = "./decklist.txt") {
  const text = printDeck(deck);
  fs.writeFileSync(text, filePath, "utf-8");
  return filePath;
}

/**
 * Updates the deck with other-language versions of each card.
 * Optionally fetches card info (needed for translations) before setting the other language.
 *
 * @param {Card[]} deck - The array of card objects to update.
 * @param {boolean} [getCardInfoFlag=true] - Whether to fetch full card info from the ID map.
 * @returns {Card[]} The updated array of cards with other-language data applied.
 */
export function getOtherLangDeck(deck, getCardInfoFlag = true) {
  const idMap = getIdMap();
  for (const card of deck) {
    if (getCardInfoFlag === true) {
      card.getCardInfoFromId(idMap);
    }
    card.setOtherLangCard(idMap);
  }
  return deck;
}

/**
 * Loads the full card list from a JSON file and builds a map keyed by `card_id`.
 *
 * @param {string} [filePath="data/synced_cards.json"] - Path to the JSON file containing synced cards.
 * @returns {Promise<Map<string, Card>>} A promise resolving to a map of card IDs to card objects.
 */
async function getIdMap(filePath = "data/synced_cards.json") {
  const cardList = JSON.parse(await fs.readFile(filePath, "utf-8"));
  return new Map(cardList.map((c) => [c.card_id, c]));
}
