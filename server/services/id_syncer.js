import fs from "fs/promises";
import Card from "../cards/card.js";

/**
 * Builds adjacency maps for a deck of cards, linking each card to its alternate IDs.
 * Creates both forward (`fwd`) and reverse (`rev`) adjacency structures for graph traversal.
 *
 * @param {Card[]} deck - The array of card objects to process.
 * @param {Map<string, Card>} idMap - A map of cards keyed by their `card_id`, used to validate alternate IDs.
 * @returns {{ fwd: Map<string, Set<string>>, rev: Map<string, Set<string>> }}
 *          An object containing:
 *          - `fwd`: Map of card IDs to the set of alternate IDs they reference.
 *          - `rev`: Map of card IDs to the set of IDs that reference them.
 */
const buildAdjacency = (deck, idMap) => {
  const fwd = new Map();
  const rev = new Map();

  for (const card of deck) {
    if (!fwd.has(card.card_id)) {
      fwd.set(card.card_id, new Set());
    }
    if (!rev.has(card.card_id)) {
      rev.set(card.card_id, new Set());
    }
  }

  for (const card of deck) {
    const currentId = card.card_id;
    const altIds = card.alternate_ids ?? [];
    for (const altId of altIds) {
      if (altId === currentId || !idMap.has(altId)) {
        continue;
      }
      fwd.get(currentId).add(altId);
      fwd.get(altId).add(currentId);
    }
  }
  return { fwd, rev };
};

/**
 * Collects all card IDs that belong to the same connected component
 * as the given seed card. Traverses both forward and reverse adjacency
 * to find every alternate ID reachable from the seed.
 *
 * @param {string} seedId - The starting card_id to explore from.
 * @param {Map<string, Set<string>>} fwd - A map where each key is a card_id and
 *   its value is the set of IDs that the card points to (forward links).
 * @param {Map<string, Set<string>>} rev - A map where each key is a card_id and
 *   its value is the set of IDs that point to that card (reverse links).
 * @returns {string[]} A sorted array of all unique card IDs in the same
 *   connected component as the seedId, including the seedId itself.
 */
const collectComponent = (seedId, fwd, rev) => {
  const seen = new Set();
  const stack = [seedId];

  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    for (const n of fwd.get(id) || []) if (!seen.has(n)) stack.push(n);
    for (const n of rev.get(id) || []) if (!seen.has(n)) stack.push(n);
  }

  return [...seen].sort();
};

/**
 * Cleans and normalizes a list of alternate IDs.
 *
 * @param {string[]} altIdList - The list of alternate IDs to clean.
 * @param {Map<string, *>} idMap - A map of valid IDs used to filter the list.
 * @returns {string[]} A sorted array of unique, valid alternate IDs.
 */
const cleanList = (altIdList, idMap) => {
  const arr = Array.isArray(altIdList) ? altIdList : [];
  return [...new Set(arr.filter((x) => x && idMap.has(x)))].sort(); // x => x makes sure there is no null or undefined values
};

const equalArray = (a, b) => {
  return a.length === b.length && a.every((v, i) => v === b[i]);
};

/**
 * Synchronizes alternate ID lists across a collection of cards.
 *
 * - Builds adjacency maps to find connected components of related cards.
 * - Ensures all cards in a connected component share the same `alternate_ids` list.
 * - Updates cards in place when their `alternate_ids` differ from the computed set.
 *
 * @param {Card[]} cardList - The list of card objects to process, each containing a `card_id` and optional `alternate_ids`.
 * @returns {Card[]} The updated list of card objects with synchronized `alternate_ids`.
 */
export function syncAltIds(cardList) {

  const idMap = new Map(cardList.map((c) => [c.card_id, c]));
  const { fwd, rev } = buildAdjacency(cardList, idMap);

  const processed = new Set();

  for (const { card_id: seed } of cardList) {
    if (processed.has(seed)) {
      continue;
    }

    const component = collectComponent(seed, fwd, rev);
    component.forEach((id) => processed.add(id));

    //If 1 or no Alt Ids, nothing gets added to the alternate ID list
    if (component.length <= 1) {
      continue;
    }

    //Otherwise, sync the alt ID list with all references of Alt ID including itself
    for (const id of component) {
      const card = idMap.get(id);
      const allIds = component.slice();
      const cleanedIds = cleanList(card.alternate_ids, idMap);

      //Just in case something went wrong
      if (!equalArray(cleanedIds, allIds)) {
        card.alternate_ids = allIds;
      }
    }
  }
  return cardList;
}

