export function mergeDatabases(dbA, dbB) {
  const mapA = new Map(dbA.map((c) => [c.card_id, c]));
  const mapB = new Map(dbB.map((c) => [c.card_id, c]));

  const allIds = new Set([...mapA.keys(), ...mapB.keys()]);
  const merged = [];

  for (const cardId of allIds) {
    const cardA = mapA.get(cardId);
    const cardB = mapB.get(cardId);

    if (cardA && cardB) {

      const mergedAlts = [
        ...new Set([
          ...(cardA.alternate_ids || []),
          ...(cardB.alternate_ids || []),
        ]),
      ].sort();

      merged.push({
        ...cardA,
        ...cardB,
        alternate_ids: mergedAlts,
      });
    } else {
      const c = cardA || cardB;
      merged.push({
        ...c,
        alternate_ids: (c.alternate_ids || []).slice().sort(),
      });
    }
  }

  return merged;
}
