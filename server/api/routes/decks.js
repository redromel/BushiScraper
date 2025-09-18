import { Router } from "express";
import {
  validateLink,
  verifyDeckExists,
} from "../middleware/validateDecklog.js";

import { getBushiDeck } from "../../services/scraper.js";
import { getOtherLangDeck } from "../../cards/deck.js";
import { buildEnDeck } from "../../services/deck_creator.js";

const router = Router();
router.post(
  "/bushiDecklist",
  validateLink,
  verifyDeckExists,
  async (req, res) => {
    const { url, deck_name } = req.body;


    console.log(`Generating EN Bushiroad link for ${url}`);
    const rawDeck = await getBushiDeck(`${url}`);
    const enDeck = await getOtherLangDeck(rawDeck);
    const deckUrl = await buildEnDeck(enDeck, deck_name);

    


    if(deckUrl === undefined){
      res.status(422).send({error: "Decklist could not be created (Deck is not Valid)"})
      return;
    }
    res
      .status(200)
      .send({ message: `Decklist Creation complete`, url: deckUrl });
  }
);

export default router;
