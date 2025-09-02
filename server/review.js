import fs from "fs/promises";
import readline from "node:readline/promises";

const addIfMissing = (arr, v) => {
  if (!v) return arr;
  if (!Array.isArray(arr)) arr = [];
  if (!arr.includes(v)) arr.push(v);
  return arr;
};
const sortIds = (c) => {
  if (Array.isArray(c.alternate_ids))
    c.alternate_ids = [...new Set(c.alternate_ids)].sort();
};
const linkCards = (enCard, jpCard) => {
  enCard.alternate_ids = addIfMissing(enCard.alternate_ids, jpCard.card_id);
  jpCard.alternate_ids = addIfMissing(jpCard.alternate_ids, enCard.card_id);
  sortIds(enCard);
  sortIds(jpCard);
};

export async function runManualReview(database, reviewItems) {
  const byId = new Map(database.map((c) => [c.card_id, c]));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let approved = 0,
    rejected = 0,
    manualLinked = 0;
  const rejectedList = [];
  try {
    for (const item of reviewItems) {
      const en = byId.get(item.enCard.en_id);
      if (!en) {
        console.log(`EN not found: ${item.enCard.en_id}`);
        continue;
      }

      console.log("\n================= Manual Review =================");
      console.table([{ card_id: en.card_id, card_name: en.card_name }]);

      for (const slim of item.jpCards) {
        const jp = byId.get(slim.jp_id);
        console.table([{ card_id: en.card_id, card_name: en.card_name }]); // show EN every time
        if (!jp) {
          console.log(`(missing) JP candidate: ${slim.jp_id} ${slim.jp_name}`);
          continue;
        }
        console.table([{ card_id: jp.card_id, card_name: jp.card_name }]);
        const ans = await rl.question("Accept this JP? (Y/N) ");
        if (ans.trim().toLowerCase().startsWith("y")) {
          linkCards(en, jp);
          approved++;
          console.log("✓ Linked");
        } else {
          rejected++;
          rejectedList.push(jp);
          console.log("✗ Rejected");
        }
      }

      const extra = (
        await rl.question(
          "Add JP card_id(s) manually? (comma/space or Enter): "
        )
      ).trim();
      if (extra) {
        for (const id of extra.split(/[\s,]+/).filter(Boolean)) {
          const jp = byId.get(id);
          if (!jp) {
            console.log(`  Not found: ${id}`);
            continue;
          }
          linkCards(en, jp);
          manualLinked++;
          console.log(`   Manually linked ${id}`);
        }
      }
    }
  } finally {
    rl.close();
  }

  console.log(
    `Review done: approved=${approved}, rejected=${rejected}, manual=${manualLinked}`
  );
  return { database, rejectedList };
}

runManualReview();
