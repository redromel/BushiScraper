const norm = (s) =>
  (s ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Normalizes card titles across Unicode differences (JP/EN).
 *
 * @param {string} s - The title string to normalize.
 * @returns {string} The normalized title.
 */
const normTitle = (s) =>
  norm(s)
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[：]/g, ":")
    .replace(/\s*[:\-–—]\s*/g, " - ")
    .replace(/\s{2,}/g, " ");

/**
 * Normalizes an array of strings:
 * - Returns an empty string if input is not an array.
 * - Normalizes each element, sorts them, and joins with "|".
 *
 * @param {unknown[]} arr - The array to normalize.
 * @returns {string} The pipe-joined normalized representation (stable key).
 */
const normalizeArray = (arr) => {
  if (!Array.isArray(arr)) return "";
  return arr
    .map((x) => norm(x))
    .sort()
    .join("|");
};

/**
 * Removes "(Evolved)" from a card name to align JP/EN naming conventions.
 *
 * @param {string} name - The original card name.
 * @returns {string} The name with "(Evolved)" stripped.
 */
const stripEvolved = (name) => {
  return name
    .toString()
    .replace(/\s*\(evolved\)\s*/gi, " ")
    .trim();
};

const compareNamesNoEvolved = (cardEn, cardJp) => {
  return normTitle(stripEvolved(cardEn)) === normTitle(stripEvolved(cardJp));
};

/**
 * Builds a stable attribute-based key for matching JP and EN cards.
 *
 * @param {Card} card - The card to key.
 * @returns {string} A deterministic key encoding core attributes.
 */ function makeKey(card) {
  return [
    `class=${norm(card.card_class)}`,
    `type=${normalizeArray(card.card_type)}`,
    `trait=${normalizeArray(card.card_trait)}`,
    `atk=${norm(card.card_atk)}`,
    `def=${norm(card.card_def)}`,
    `cost=${norm(card.card_cost)}`,
    `format=${norm(card.card_format)}`,
    `type=${normalizeArray(card.card_type)}`,
    `set=${norm(card.card_set)}`
  ].join("|");
}

/**
 * Creates an index (Map) from a list of items using a key function.
 *
 * @template T
 * @param {T[]} items - The items to index.
 * @param {(item: T) => string} keyFn - Function producing a key for each item. Falsy keys are skipped.
 * @returns {Map<string, T[]>} A map from key to array of matching items.
 */
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

/**
 * Builds a review object summarizing candidate JP matches for an EN card.
 *
 * @param {Card} enCard - The English card under review.
 * @param {Card[]} candidates - Candidate JP cards sharing attributes.
 * @returns  A compact review record.
 */
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

/**
 * Matches English and Japanese card equivalents and links their `alternate_ids`.
 *
 * @param {Card[]} database - Full card database containing mixed languages.
 * @returns {{ reviewedDb: Card[], cardReview: ReturnType<typeof itemReview>[] }}
 *          `reviewedDb`: all cards (EN + JP) with links applied;
 *          `cardReview`: unresolved EN cards with zero or multiple JP candidates.
 */
export function matchJpAndEn(database) {
  const cardsEn = database.filter(
    (card) => (card.lang || "").toLowerCase() === "en"
  );
  const cardsJp = database.filter(
    (card) => (card.lang || "").toLowerCase() === "jp"
  );

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

  console.log(`Completed Matching, Items to Review:  ${cardReview.length}`);
  const reviewedDb = [...cardsEn, ...cardsJp];
  return { reviewedDb, cardReview };
}
