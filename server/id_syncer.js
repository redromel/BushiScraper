import fs from "fs/promises";

//builds neighbors of both when an ID gets refrenced in an Alt ID, and when and the Alt ID references the ID to make sure there is no ID left behind
const buildAdjecency = (database, idMap) => {
  const fwd = new Map();
  const rev = new Map();

  for (const card of database) {
    if (!fwd.has(card.card_id)) {
      fwd.set(card.card_id, new Set());
    }
    if (!rev.has(card.card_id)) {
      rev.set(card.card_id, new Set());
    }
  }

  for (const card of database) {
    const currentCard = card.card_id;
    const altIds = Array.isArray(card.alternate_ids) ? card.alternate_ids : [];
    for (const altCard of altIds) {
      if (!altCard || altCard == currentCard || !idMap.has(altCard)) {
        continue;
      }
      fwd.get(currentCard).add(altCard);
      fwd.get(altCard).add(currentCard);
    }
  }
  return { fwd, rev };
};

//Gets a filled altID list
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

const cleanList = (altIdList, idMap) => {
  const arr = Array.isArray(altIdList) ? altIdList : [];
  return [...new Set(arr.filter((x) => x && idMap.has(x)))].sort(); // x => x makes sure there is no null or undefined values
};

const equalArray = (a, b) => {
  return a.length === b.length && a.every((v, i) => v === b[i]);
};

export function syncAltIds(database) {
  const idMap = new Map(database.map((c) => [c.card_id, c]));
  const { fwd, rev } = buildAdjecency(database, idMap);

  const processed = new Set();

  for (const { card_id: seed } of database) {
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
  return database;
}

const db = JSON.parse(await fs.readFile("data/reviewed_cards.json", "utf-8"));
const database = syncAltIds(db);
await fs.writeFile("data/synced_cards.json", JSON.stringify(database, null, 2));
