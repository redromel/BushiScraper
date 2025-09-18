import fs from "fs/promises";
import Card from "./card.js";

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
export async function getOtherLangDeck(deck, getCardInfoFlag = true) {
  const idMap = await getIdMap();
  for (const card of deck) {
    if (getCardInfoFlag === true) {
      card.getCardInfoFromId(idMap);
    }
    card.setOtherLangCard(idMap);
  }
  return deck;
}
/**
 * Validates a decklist against language, class, and trait rules.
 *
 * The validation process works as follows:
 * 1. Filters out any "Leader" cards (both EN and JP variants).
 * 2. Ensures the remaining deck is entirely in English
 * 3. Collects unique classes (excluding "Neutral"):
 *    - If exactly one unique class remains, returns that class.
 *    - If multiple classes exist, checks whether every card in the deck
 *      belongs to the same "universe" (special trait group, e.g. Vanguard, iM@S CG, Umamusume).
 *      If so, returns that universe trait.
 * 4. Returns `null` if the deck fails validation (not all EN, no consistent class/trait).
 *
 * @param {Array<Object>} deck - Array of card objects to validate.
 * @returns {string|null} The validated deck identity:
 *   - Returns the unique class name if the deck is consistent.
 *   - Returns the shared "universe" trait if multiple classes exist but all cards share the same trait.
 *   - Returns `null` if validation fails.
 */
export function validateDeck(deck) {
  //Leaders are more likely to not have an EN variant but is not needed to actually play the game
  const filteredDeck = deck.filter((card) => {
    return !card.card_type.some(
      (trait) => trait === "Leader" || trait === "リーダー"
    );
  });
  
  const uniqueLangs = [...new Set(filteredDeck.map((card) => card.lang))];

  if (!(uniqueLangs.length === 1 && uniqueLangs[0] === "en")) {
    console.log("multi Langs");
    console.log(uniqueLangs);
    return null;
  }

  const uniqueClasses = [
    ...new Set(filteredDeck.map((card) => card.card_class)),
  ].filter((cls) => cls !== "Neutral");

  if (uniqueClasses.length !== 1) {
    console.log("too many classes");
    const trait = findUniverseTrait(filteredDeck);
    return trait;
  }

  return uniqueClasses[0];
}
/**
 * Loads the full card list from a JSON file and builds a map keyed by `card_id`.
 *
 * @param {string} [filePath="data/synced_cards.json"] - Path to the JSON file containing synced cards.
 * @returns {Promise<Map<string, Card>>} A promise resolving to a map of card IDs to card objects.
 */
export async function getIdMap(filePath = "./server/data/synced_cards.json") {
  const raw = await fs.readFile(filePath, "utf8");
  const cardList = JSON.parse(raw);
  return new Map(cardList.map((c) => [c.card_id, c]));
}

export function findUniverseTrait(deck) {
  // map internal trait to display name
  const universeMap = {
    Umamusume: "Umamusume: Pretty Derby",
    "iM@S CG": "THE IDOLM@STER CINDERELLA GIRLS",
    Vanguard: "Cardfight!! Vanguard",
  };

  for (const [trait, displayName] of Object.entries(universeMap)) {
    if (deck.every((card) => card.card_trait.includes(trait))) {
      return displayName;
    }
  }

  return null;
}
