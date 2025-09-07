import { chromium } from "playwright";
import { expect } from "playwright/test";
import { validateDeck } from "./deck.js";

async function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("addCards timed out")), ms)
    ),
  ]);
}


/**
 * Clicks the Decklog "Create" button and waits for completion, returning the deck URL.
 *
 * Behavior:
 * - On the first attempt, waits for the blue "Create" button and clicks it.
 * - On subsequent attempts, prefers the red "Create" button if visible; otherwise clicks blue again.
 * - Races the "success" UI (".views-complete") against a known failure message ("Failed to create deck").
 *
 * @async
 * @param {import('playwright').Page} page - The Playwright page instance.
 * @param {number} [maxAttempts=3] - Maximum number of create/confirm attempts.
 * @returns {Promise<string | undefined>} The created deck URL if successful; otherwise `undefined`.
 * @throws {Error} If the success UI appears but the confirmation link lacks an `href`.
 */
async function confirmDeck(page, maxAttempts = 3) {
  let deckUrl = null;

  const blueButton = page.locator("button.btn-info.btn-secondary", {
    hasText: "Create",
  });
  const redButton = page.locator("button.btn-warning.btn-secondary", {
    hasText: "Create",
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt === 1) {
      await blueButton.waitFor({ state: "visible", timeout: 60000 });
      await blueButton.click();
    } else {
      if (await redButton.isVisible()) {
        console.log("Clicking red Create button…");
        await redButton.click();
      } else {
        console.log("Red not visible, clicking blue Create…");
        await blueButton.click();
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

      await confirmLink.click();

      return deckUrl;
    }
    console.warn(`Attempt ${attempt} ${outcome}; will retry…`);
  }
  return;
}


/**
 * Selects and adds a specific card to the current deck on Decklog.
 *
 * Flow:
 *  1) Clears the keyword box and searches by `card.card_id`.
 *  2) If no results:
 *     - If the card is a Leader, picks the first visible Leader tile by default.
 *     - Otherwise, iterates `card.alternate_ids` until a match is found; mutates `card.card_id` to the working ID.
 *  3) Calls `addCards` to click the "+" button `quantity` times.
 *  4) Retries on failure using a bounded recursive strategy.
 *
 * Side effects:
 *  - May mutate `card.card_id` when an alternate ID is used.
 *
 * @async
 * @param {import('playwright').Page} page - Playwright page instance.
 * @param {{
 *   card_id: string,
 *   card_name?: string,
 *   card_type?: string[] | string,
 *   alternate_ids?: string[],
 *   quantity: number
 * }} card - Card descriptor with ID, optional metadata, and desired quantity.
 * @param {number} [retryAttempts=3] - Max number of retries if `addCards` fails.
 * @param {number} [attemptNumber=0] - Internal attempt counter (do not set manually).
 * @returns {Promise<void>} Resolves when the card has been added (or when the function gives up after retries).
 * @throws {Error} If no results are found for the original ID and all alternates.
 */
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


/**
 * Adds a card (by ID) to the current deck on the Decklog site.
 *
 * @async
 * @param {import('playwright').Page} page - The Playwright page instance.
 * @param {{ card_id: string, card_name?: string, quantity: number }} card - The card to add, with ID and quantity.
 * @returns {Promise<void>} Resolves when the card has been added.
 */
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

/**
 * Waits for a Bushiroad Decklog search results cycle to complete.
 *
 * Behavior:
 * - Captures the initial card tile count.
 * - If there were tiles before typing, waits for them to clear to `0`.
 * - If already empty, briefly waits to allow debounce.
 * - Then waits for either new tiles to appear or a `zero_result` state.
 * - Returns whether the results are empty and how many tiles were found.
 *
 * @async
 * @param {import('playwright').Page} page - The Playwright page instance.
 * @param {{ clearTimeout?: number, readyTimeout?: number }} [options={}] - Optional timeouts in ms.
 * @param {number} [options.clearTimeout=750] - How long to wait for old tiles to clear.
 * @param {number} [options.readyTimeout=750] - How long to wait for new results or zero state.
 * @returns {Promise<{ zero: boolean, count: number }>} Resolves with `zero` (true if no results) and `count` (number of result tiles).
 */
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
/**
 * Validates and creates an EN Bushiroad Decklog entry from a list of cards. Returning the link of the link of the new Decklog if successful
 *
 *
 * @async
 * @param {Card[]} cardList - The cards to add (must include `card_id`, `card_name`, `card_type`, `quantity`).
 * @param {string|null} [deckName=null] - Optional deck name; if omitted, a timestamped name is generated.
 * @returns {Promise<string>} Resolves to the Decklog URL of the created deck.
 * @throws {Error} If deck is invalid, class selection fails, or deck creation cannot be confirmed.
 *
 */
export async function createDecklist(cardList, deckName = null) {
  const cardClass = validateDeck(cardList);

  if (!deckName) {
    const date = new Date();
    deckName = `Bushiscraper ${cardClass} Deck ${date.getMonth()}-${
      date.getDate() + 1
    }-${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
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

  console.log(`Generating Link...`);
  //Deck confirmation
  await page.getByRole("button", { name: "Confirm Deck" }).click();
  await page.getByRole("textbox", { name: "Enter deck name" }).click();
  await page.getByRole("textbox", { name: "Enter deck name" }).fill(deckName);

  let deckUrl = await confirmDeck(page);

  // If all retries failed
  if (!deckUrl) {
    browser.close();
    throw new Error("Could not create deck.");
  } else {
    console.log("Deck created at:", deckUrl);
    browser.close();
    return deckUrl;
  }
}
