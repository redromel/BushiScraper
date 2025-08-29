import axios from "axios";
import { readFile } from "fs";
import fs from "fs/promises";

const norm = (s) =>
  (s ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");

//To Deal unicode differences between JP and EN
const normTitle = (s) =>
  norm(s)
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[：]/g, ":")
    .replace(/\s*[:\-–—]\s*/g, " - ")
    .replace(/\s{2,}/g, " ");
//String and Array normalizing functions to get more consistent fields
const normalizeArray = (arr) => {
  if (!Array.isArray(arr)) return "";
  return arr
    .map((x) => norm(x))
    .sort()
    .join("|");
};

//Some JP cards don't have the (Evolved) at the end so this is being used to normalize searches
const stripEvolved = (name) => {
  return name
    .toString()
    .replace(/\s*\(evolved\)\s*/gi, " ")
    .trim();
};

const compareNamesNoEvolved = (cardEn, cardJp) => {
  return normTitle(stripEvolved(cardEn)) === normTitle(stripEvolved(cardJp));
};
//Key to compare JP and EN cards (titles can be different so it is not a part of the key)
function makeKey(card) {
  return [
    `class=${norm(card.card_class)}`,
    `type=${normalizeArray(card.card_type)}`,
    `trait=${normalizeArray(card.card_trait)}`,
    `atk=${norm(card.card_atk)}`,
    `def=${norm(card.card_def)}`,
    `cost=${norm(card.card_cost)}`,
    `cost=${norm(card.card_format)}`,
    `cost=${normalizeArray(card.card_type)}`,
  ].join("|");
}

//creates Map based on certain funtions
const createIndex = (items, keyFn) => {
  const map = new Map();
  for (const value of items) {
    const k = keyFn(value);
    if (!k) {
      continue;
    }
    if (!map.has(k)) {
      map.set(k, []);
    }
    map.get(k).push(value);
  }
  return map;
};

const linkCards = (enCard, jpCard) => {
  enCard.alternate_ids.push(jpCard.card_id);
  jpCard.alternate_ids.push(enCard.card_id);
};

const itemReview = (enCard, candidates) => ({
  matches: candidates.length,
  enCard: {
    en_id: enCard.card_id,
    en_name: enCard.card_name,
    en_type: enCard.card_type,
  },
  jpCards: candidates.map((jpCard) => ({
    jp_id: jpCard.card_id,
    jp_name: jpCard.card_name,
  })),
});

// Matches En and Jp card equivalents
export async function matchJpAndEn(
  inPath = "./cards.json",
  outPath = "./new_cards.json",
  reviewFilePath = "./review_cards.json",
  skipArray = ["gloryfinder", "evolution point"]
) {
  const db = JSON.parse(await fs.readFile(inPath, "utf-8"));

  const cardsEn = db.filter((card) => (card.lang || "").toLowerCase() === "en");
  const cardsJp = db.filter((card) => (card.lang || "").toLowerCase() === "jp");

  const jpMapTitle = createIndex(cardsJp, (c) => norm(c.card_name));
  const jpMapAttr = createIndex(cardsJp, makeKey);

  const cardReview = [];

  for (const cardEn of cardsEn) {
    //Skipping Gloryfinder and Evolution Point cards because there is no JP version
    if (
      norm(cardEn.card_type) === "evolution point" ||
      norm(cardEn.card_format) === "gloryfinder"
    ) {
      continue;
    }

    // Find exact title match first
    const sameTitle = jpMapTitle.get(normTitle(cardEn.card_name)) || [];
    if (sameTitle.length > 0) {
      for (const cardJp of sameTitle) {
        linkCards(cardEn, cardJp);
      }
      continue;
    }

    const sameAttr = jpMapAttr.get(makeKey(cardEn)) || [];
    if (sameAttr.length === 0) {
      cardReview.push(itemReview(cardEn, []));
      continue;
    }

    // given same attributes, JP cards sometimes doesnt have the word (Evolved) so we can compare the 2 cards with that word removed
    const cardJpMatches = sameAttr.filter((jpC) =>
      compareNamesNoEvolved(cardEn.card_name, jpC.card_name)
    );
    if (cardJpMatches.length > 0) {
      for (const cardJp of cardJpMatches) {
        linkCards(cardEn, cardJp);
      }
    } else {
      cardReview.push(itemReview(cardEn, sameAttr));
    }
  }

  await fs.writeFile(
    reviewFilePath,
    JSON.stringify(cardReview, null, 2),
    "utf-8"
  );
  await fs.writeFile(
    outPath,
    JSON.stringify([...cardsEn, ...cardsJp], null, 2),
    "utf-8"
  );
  console.log(`Completed Matching, Items to Review:  ${cardReview.length}`);
}

matchJpAndEn();
