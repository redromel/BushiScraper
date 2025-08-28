import axios from "axios";
import fs from "fs/promises";

async function getDatabase(url, filePath = "./cards.json") {
  const { data: cardsData } = await axios.get(url);
  await fs.writeFile(filePath, JSON.stringify(cardsData, null, 2), "utf-8");
}

//Adds JP card_ids to EN alternate_ids and vice versa
async function addAltIds(filePath = "./new_cards.json") {
  const dbFilePath = "./cards.json";
  const cards = await fs.readFile(dbFilePath, "utf-8");
  const database = JSON.parse(cards);
  const cardsEN = database.filter(
    (card) => (card.lang || "").toLowerCase() === "en"
  );
  const cardsJP = database.filter(
    (card) => (card.lang || "").toLowerCase() === "jp"
  );

  const cardIndexJP = buildJpCardIndex(cardsJP);

  const cardReview = [];
  const noMatches = [];

  for (const enCard of cardsEN) {
    const enKey = makeKey(enCard);
    const jpMatch = cardIndexJP.get(enKey) || [];

    if (jpMatch.length === 0) {
      var hasMatch = false;
      //Some cards dont match due to translation issues, so if the name exactly matches, then it will be added to the alternate IDs
      for (const jpCard of cardsJP) {
        if (norm(enCard.card_name) === norm(jpCard.card_name)) {
          enCard.alternate_ids.push(jpCard.card_id);
          jpCard.alternate_ids.push(enCard.card_id);
          hasMatch = true;
        }
      }
      if (hasMatch === false) {
        noMatches.push(enCard);
      }
      continue;
    }
    if (jpMatch.length > 1) {
      let hasMatch = false;
      for (const jpCard of jpMatch) {
        if (norm(stripEvolved(enCard.card_name)) === norm(stripEvolved(jpCard.card_name))) {
          enCard.alternate_ids.push(jpCard.card_id);
          jpCard.alternate_ids.push(enCard.card_id);
          hasMatch = true;
          break;
        }
      }
      if (hasMatch === false) {
        cardReview.push({
          matches: jpMatch.length,
          enCard: {
            en_id: enCard.card_id,
            en_name: enCard.card_name,
          },
          jpCards: jpMatch.map((jp) => ({
            jp_id: jp.card_id,
            jp_name: jp.card_name,
          })),
        });
      }
    }
    if (jpMatch.length === 1) {
      const jpCard = jpMatch[0];
      if (norm(stripEvolved(enCard.card_name)) === norm(stripEvolved(jpCard.card_name))) {
        enCard.alternate_ids.push(jpCard.card_id);
        jpCard.alternate_ids.push(enCard.card_id);
      } else {
        cardReview.push({
          matches: jpMatch.length,
          enCard: {
            en_id: enCard.card_id,
            en_name: enCard.card_name,
          },
          jpCards: jpMatch.map((jp) => ({
            jp_id: jp.card_id,
            jp_name: jp.card_name,
          })),
        });
      }
    }
  }
  const combinedCards = [...cardsEN, ...cardsJP];
  await fs.writeFile(
    "./no_matches.json",
    JSON.stringify(noMatches, null, 2),
    "utf-8"
  );
  await fs.writeFile(
    "./card_review.json",
    JSON.stringify(cardReview, null, 2),
    "utf-8"
  );
  await fs.writeFile(filePath, JSON.stringify(combinedCards, null, 2), "utf-8");
}




//String and Array normalizing functions to get more consistent fields
function normalizeArray(arr) {
  if (!Array.isArray(arr)) return "";
  return arr
    .map((x) => norm(x))
    .sort()
    .join("|");
}

function norm(s) {
  return (s ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

//Some JP cards don't have the (Evolved) at the end so this is being used to normalize searches
function stripEvolved(name) { 
  return (name ?? "")
    .toString()
    .replace(/\s*\(evolved\)\s*/gi, " ")
    .trim();
}

//Key to compare JP and EN cards (titles can be different so it is not a part of the key)
function makeKey(card) {
  return [
    `class=${norm(card.card_class)}`,
    `type=${normalizeArray(card.card_type)}`,
    `trait=${normalizeArray(card.card_trait)}`,
    `atk=${norm(card.card_atk)}`,
    `def=${norm(card.card_def)}`,
    `cost=${norm(card.card_cost)}`,
  ].join("|");
}

//Helps index JP cards that have the same class, type, trait, atk, def, and cost
function buildJpCardIndex(jpCardList) {
  const jpCardIndex = new Map();

  jpCardList.forEach((jpCard) => {
    const compositeKey = makeKey(jpCard);

    if (jpCardIndex.has(compositeKey)) {
      jpCardIndex.get(compositeKey).push(jpCard);
    } else {
      jpCardIndex.set(compositeKey, [jpCard]);
    }
  });

  return jpCardIndex;
}

await addAltIds();
