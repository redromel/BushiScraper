import { Router } from "express";
import {
  validateLink,
  verifyDeckExists,
  validateLinkPair,
  verifyBothExist,
} from "../middleware/validateDecklog.js";

import { getBushiDeck } from "../../services/scraper.js";
import {
  compareDecks,
  getDeckInfoFromId,
  getOtherLangDeck,
  printDeck,
} from "../../cards/deck.js";
import { buildEnDeck } from "../../services/deck_creator.js";

const router = Router();
router.post(
  "/bushiDecklist",
  validateLink,
  verifyDeckExists,
  async (req, res) => {
    let { url, deck_name } = req.body;

    console.log(`Generating EN Bushiroad link for ${url}`);
    const { deck: rawDeck, title } = await getBushiDeck(`${url}`);
    const deck = await getDeckInfoFromId(rawDeck);
    const enDeck = await getOtherLangDeck(deck);

    if (deck_name === undefined || deck_name === null) {
      deck_name = title + " EN";
    }

    const deckUrl = await buildEnDeck(enDeck, deck_name);
    if (deckUrl === undefined || deckUrl === null) {
      res.status(422).send({
        error:
          "Decklist could not be created (Deck is not Valid or from a future set)",
      });
      return;
    }
    res
      .status(200)
      .send({ message: `Decklist Creation complete`, url: deckUrl });
  }
);
router.post(
  "/simDecklist",
  validateLink,
  verifyDeckExists,
  async (req, res) => {
    const { url } = req.body;
    const { lang } = req.decklog;

    const { deck: rawDeck } = await getBushiDeck(`${url}`);
    let deck = await getDeckInfoFromId(rawDeck);
    if (lang === "jp") {
      deck = await getOtherLangDeck(rawDeck);
    }

    const printedDeck = printDeck(deck);

    res.status(200).send({
      message: `Decklist for https://sveclient.vercel.app/ complete`,
      deck: printedDeck,
    });
  }
);

router.post("/compare", validateLinkPair, verifyBothExist, async (req, res) => {
  const { urlA, urlB } = req.body;
  const { deck: rawDeckA } = await getBushiDeck(`${urlA}`);
  const deckA = await getDeckInfoFromId(rawDeckA);
  const { deck: rawDeckB } = await getBushiDeck(`${urlB}`);
  const deckB = await getDeckInfoFromId(rawDeckB);

  try {
    const { sameCard, removedCards, addedCards } = await compareDecks(
      deckA,
      deckB
    );

    return res.status(200).json({
      message: "Deck successfully compared",
      summary: {
        sameCard: sameCard.length,
        removed: removedCards.length,
        added: addedCards.length,
      },
      details: {
        sameCard,
        removedCards,
        addedCards,
      },
    });
  } catch (error) {
    console.error("compareDecks failed:", error);
    res.status(500).json({ error: "Failed to compare decks" });
    return;
  }
});

export default router;
