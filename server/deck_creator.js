import { chromium } from "playwright";
import { expect } from "playwright/test";
import { validateDeck } from "./deck.js";

async function confirmDeck(page, maxAttempts = 3) {
  let deckUrl = null;

  const blueCreate = page.locator("button.btn-info.btn-secondary", {
    hasText: "Create",
  });
  const redCreate = page.locator("button.btn-warning.btn-secondary", {
    hasText: "Create",
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt === 1) {
      await blueCreate.waitFor({ state: "visible", timeout: 60000 });
      await blueCreate.click();
    } else {
      if (await redCreate.isVisible()) {
        console.log("Clicking red Create button…");
        await redCreate.click();
      } else {
        console.log("Red not visible, clicking blue Create…");
        await blueCreate.click();
      }
    }

    let outcome = "timeout";
    try {
      outcome = await Promise.race([
        page
          .waitForSelector(".views-complete", { timeout: 60000 })
          .then(() => "success"),
        page
          .waitForSelector("text=Failed to create deck", { timeout: 60000 })
          .then(() => "failure"),
      ]);
    } catch {}

    if (outcome === "success") {
      const confirmLink = page.locator("a.complete-deck-viewlink").first();
      const href = await confirmLink.getAttribute("href");
      if (!href) {
        throw new Error(
          "Confirm link is missing href after success UI appeared."
        );
      }
      deckUrl = new URL(href, page.url()).toString();

      // Optionally follow the link (comment out if you only need the URL)
      await confirmLink.click();

      return deckUrl;
    }
    console.warn(`Attempt ${attempt} ${outcome}; will retry…`);
  }
  return;
}

async function selectCard(page, card, retryAttempts = 3, attemptNumber = 0) {
  const clearButton = page
    .locator('input[name="keyword"] ~ .clear_keyword_btn')
    .first();

  //Clearing Before  ensure clean searchbox
  await clearButton.click();

  const search = await page.getByRole("textbox", { name: "Enter keyword" });
  await search.click();
  await search.fill(card.card_id);

  const { zero, count } = await waitResultsCycle(page);

  if (zero || count === 0) {
    //If theres no valid leader card, grab the first one from the default list

    const isLeader =
      card.card_type?.includes("Leader") ||
      card.card_type?.includes("リーダー");
    if (isLeader) {
      await clearButton.click();
      const leaderTile = page
        .locator(
          "#search-results > .card-item .card-container img.card-search-item"
        )
        .first();
      await waitResultsCycle(page);
      await leaderTile.waitFor({ state: "visible" });
      await leaderTile.dblclick();
      return;
    }

    //Try all alternate Ids if original did not work
    let usedId = null;
    if (card.alternate_ids.length > 0) {
      for (let i = 0; i < card.alternate_ids.length; i++) {
        await clearButton.click();
        await search.click();
        await search.fill(card.alternate_ids[i]);

        const { zero: altZero, count: altCount } = await waitResultsCycle(page);

        if (!altZero && altCount > 0) {
          usedId = card.alternate_ids[i];
          break;
        }
        await clearButton.click();
      }
    }

    if (!usedId) {
      throw Error(`No results for ${card.card_id}:  ${card.card_name}`);
    }
    card.card_id = usedId;
  }

  try {
    await withTimeout(addCards(page, card), 3000);
  } catch (error) {
    if (attemptNumber < retryAttempts) {
      const newAttempts = attemptNumber + 1;
      console.warn(`Attempt #${newAttempts}`);
      await selectCard(page, card, retryAttempts, newAttempts);
    } else {
      console.log("Could not get card");
    }
  }
}

async function addCards(page, card) {
  const matchTile = page
    .locator("#search-results > .card-item")
    .filter({
      has: page.locator(
        `.card-container img.card-search-item[title^="${card.card_id}"]`
      ),
    })
    .first();

  await matchTile.waitFor({ state: "visible" });
  await matchTile.scrollIntoViewIfNeeded();

  // Activate tile
  const img = matchTile.locator(".card-container img.card-search-item").first();

  await img.click();

  // Wait for Plus Button to show
  const plus = matchTile.locator(".card-ctrl.card-inc").first();
  await plus.waitFor({ state: "visible" });

  for (let i = 0; i < card.quantity; i++) {
    await matchTile.locator(".card-ctrl.card-inc").first().click();
  }
}

async function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("addCards timed out")), ms)
    ),
  ]);
}
async function waitResultsCycle(
  page,
  { clearTimeout = 750, readyTimeout = 750 } = {}
) {
  const root = page.locator("#search-results");
  const tiles = root.locator("> .card-item");

  // How many tiles are there before we type?
  const before = await tiles.count().catch(() => 0);

  // After typing, many UIs clear the list to 0 while loading.
  if (before > 0) {
    await expect(tiles)
      .toHaveCount(0, { timeout: clearTimeout })
      .catch(() => {});
  } else {
    // If it was already empty, give the debounce a tick.
    await page.waitForTimeout(100);
  }

  // Now wait for either new items or a 'zero_result' state.
  const zeroState = page.locator("#search-results.zero_result");
  await Promise.race([
    tiles.first().waitFor({ state: "visible", timeout: readyTimeout }),
    zeroState.waitFor({ state: "attached", timeout: readyTimeout }),
  ]).catch(() => {});

  const zero = (await zeroState.count()) > 0;
  const count = await tiles.count().catch(() => 0);
  return { zero, count };
}

export async function createDecklist(cardList, deckName = null) {
  const cardClass = validateDeck(cardList);

  if (!deckName) {
    const date = new Date();
    deckName = `Bushiscraper ${cardClass} Deck ${date.getMonth()}-${date.getDate()}-${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
  }

  console.log("Validating Deck");
  if (cardClass === null) {
    console.log("Invalid Deck");
    return;
  }
  console.log(`Creating ${cardClass} Deck...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("https://decklog-en.bushiroad.com/create?c=6", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });

  const cookieDialog = page.locator("#CybotCookiebotDialog");

  await cookieDialog
    .waitFor({ state: "visible", timeout: 8000 })
    .catch(() => {});
  if (await cookieDialog.isVisible()) {
    await cookieDialog
      .locator("#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll")
      .click({ timeout: 1000 })
      .catch(() => {});
  }

  //Click on the Standard Deck (this will not be used for gloryfinder)
  await page.locator(".search-radio").getByText("Standard").click();
  //Selecting which Class the Deck is in
  try {
    await page.locator('select[name="class_name"]').selectOption(cardClass);
  } catch (e) {
    throw new Error(`Invalid class "${cardClass}": ${e.message}`);
  }

  //Groups cards into Leader, Main, and Evolved, and grabs the card
  const selector = page.locator(".form-group.deck-select");
  const leaderCard = cardList.filter(
    (c) => c.card_type?.includes("Leader") || c.card_type?.includes("リーダー")
  );

  await selector.getByText("Leader").click();
  await waitResultsCycle(page);
  for (const card of leaderCard) {
    console.log(card.card_id, card.card_name);
    await selectCard(page, card);
  }

  const mainCards = cardList.filter(
    (c) =>
      !c.card_type?.includes("Evolved") &&
      !c.card_type?.includes("Leader") &&
      !c.card_type?.includes("リーダー") &&
      !c.card_type?.includes("Advanced")
  );

  await selector.getByText("Main Deck").click();
  await waitResultsCycle(page);
  for (const card of mainCards) {
    console.log(card.card_id, card.card_name);
    await selectCard(page, card);
  }

  const evolvedCards = cardList.filter(
    (c) => c.card_type?.includes("Evolved") || c.card_type?.includes("Advanced")
  );
  await selector.getByText("Evolve Deck").click();
  await waitResultsCycle(page);
  for (const card of evolvedCards) {
    console.log(card.card_id, card.card_name);
    await selectCard(page, card);
  }

  console.log(`Generating Link...`)
  //Deck confirmation
  await page.getByRole("button", { name: "Confirm Deck" }).click();
  await page.getByRole("textbox", { name: "Enter deck name" }).click();
  await page.getByRole("textbox", { name: "Enter deck name" }).fill(deckName);

  let deckUrl = await confirmDeck(page);

  // If all retries failed
  if (!deckUrl) {
    throw new Error("Could not create deck.");
  } else {
    console.log("Deck created at:", deckUrl);
  }

  browser.close();
}
