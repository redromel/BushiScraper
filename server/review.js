
import fs from "fs/promises";
import readline from "node:readline/promises";

function addIfMissing(arr, value) {
  if (!value) return arr;
  if (!Array.isArray(arr)) arr = [];
  if (!arr.includes(value)) arr.push(value);
  return arr;
}
function tidyAlternateIds(card) {
  if (Array.isArray(card.alternate_ids)) {
    card.alternate_ids = [...new Set(card.alternate_ids)].sort();
  }
}

async function manualReview(
  dbPath = "./new_cards.json",
  reviewPath = "./card_review.json",
) {
  // Load db and build byId map
  const db = JSON.parse(await fs.readFile(dbPath, "utf-8"));
  const byId = new Map(db.map(c => [c.card_id, c]));

  // Load card_review.json
  const reviewItems = JSON.parse(await fs.readFile(reviewPath, "utf-8"));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let approved = 0, rejected = 0;

  try {
    for (const item of reviewItems) {
      const en = byId.get(item.enCard.en_id) || {
        card_id: item.enCard.en_id,
        card_name: item.enCard.en_name,
        alternate_ids: []
      };

      console.log("\n================= Manual Review =================");
      console.log("EN:");
      console.table([{ card_id: en.card_id, card_name: en.card_name }]);

      for (const jp of item.jpCards) {
        const jpCanonical = byId.get(jp.jp_id) || {
          card_id: jp.jp_id,
          card_name: jp.jp_name,
          alternate_ids: []
        };

        console.log("\nJP candidate:");
        console.table([{ card_id: jpCanonical.card_id, card_name: jpCanonical.card_name }]);

        const ans = await rl.question("Accept this JP for the EN card? (Y/N) ");
        if (ans.trim().toLowerCase().startsWith("y")) {
          en.alternate_ids = addIfMissing(en.alternate_ids, jpCanonical.card_id);
          jpCanonical.alternate_ids = addIfMissing(jpCanonical.alternate_ids, en.card_id);
          tidyAlternateIds(en);
          tidyAlternateIds(jpCanonical);
          approved++;
          console.log("✓ Linked via alternate_ids.");
        } else {
          rejected++;
          console.log("✗ Rejected.");
        }
      }
    }
  } finally {
    rl.close();
  }

  // Save updated DB
  await fs.writeFile("./new_cards.json", JSON.stringify(db, null, 2), "utf-8");

  console.log(`\nReview finished. Approved: ${approved}, Rejected: ${rejected}`);
  console.log("✅ Wrote cards.updated.json");
}

await manualReview()
