import fs from "fs/promises";
import readline from "node:readline/promises";

const addIfMissing = (arr, v) => {
  if (!v) return arr;
  if (!Array.isArray(arr)) arr = [];
  if (!arr.includes(v)) arr.push(v);
  return arr;
};
const tidy = (c) => {
  if (Array.isArray(c.alternate_ids))
    c.alternate_ids = [...new Set(c.alternate_ids)].sort();
};
const link = (a, b) => {
  a.alternate_ids = addIfMissing(a.alternate_ids, b.card_id);
  b.alternate_ids = addIfMissing(b.alternate_ids, a.card_id);
  tidy(a);
  tidy(b);
};

export async function runManualReview({
  dbPath = "./new_cards.json",
  reviewPath = "./review_cards.json",
  outPath = "./reviewed_cards.json",
} = {}) {
  const db = JSON.parse(await fs.readFile(dbPath, "utf-8"));
  const byId = new Map(db.map((c) => [c.card_id, c]));
  const items = JSON.parse(await fs.readFile(reviewPath, "utf-8"));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let approved = 0,
    rejected = 0,
    manualLinked = 0;

  try {
    for (const item of items) {
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
          link(en, jp);
          approved++;
          console.log("✓ Linked");
        } else {
          rejected++;
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
            console.log(`  ⚠ Not found: ${id}`);
            continue;
          }
          link(en, jp);
          manualLinked++;
          console.log(`  ✓ Manually linked ${id}`);
        }
      }
    }
  } finally {
    rl.close();
  }

  await fs.writeFile(outPath, JSON.stringify(db, null, 2), "utf-8");
  console.log(
    `Review done: approved=${approved}, rejected=${rejected}, manual=${manualLinked}`
  );
  console.log(`Wrote ${outPath}`);
}

runManualReview();