import { error } from "console";
import { validateDeck } from "../cards/deck.js";

export async function buildEnDeck(cardList, deckName = null) {
  const cardClass = validateDeck(cardList);

  if (deckName === undefined || deckName === null) {
    const date = new Date();
    deckName = `Bushiscraper ${cardClass} Deck ${date.getMonth()}-${
      date.getDate() + 1
    }-${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
  }

  if (cardClass === undefined || cardClass === null) {
    console.log("Invalid Deck");
    return;
  }

  const mainCards = cardList.filter(
    (c) =>
      !c.card_type?.includes("Evolved") &&
      !c.card_type?.includes("Leader") &&
      !c.card_type?.includes("リーダー") &&
      !c.card_type?.includes("Advanced")
  );
  const evolvedCards = cardList.filter(
    (c) => c.card_type?.includes("Evolved") || c.card_type?.includes("Advanced")
  );
  const leaderCard = cardList.filter(
    (c) => c.card_type?.includes("Leader") || c.card_type?.includes("リーダー")
  );

  const payload = {
    id: "",
    deck_id: "",
    title: deckName,
    memo: "",
    deck_param1: "N",
    deck_param2: cardClass,
    add_param1: "",
    add_param2: "",
    no: mainCards.map((c) => c.card_id),
    num: mainCards.map((c) => c.quantity),
    sub_no: evolvedCards.map((c) => c.card_id),
    sub_num: evolvedCards.map((c) => c.quantity),
    p_no: leaderCard.map((c) => c.card_id),
    p_num: [1],
    p_slot: [null],
    g_no: [],
    has_session: false,
    token_id: "",
    token: "",
  };

  const data = await fetch(
    "https://decklog-en.bushiroad.com/system/app/api/publish/6",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        Accept: "application/json, text/plain, */*",
        Origin: "https://decklog-en.bushiroad.com",
        Referer: "https://decklog-en.bushiroad.com/create?c=6",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(payload),
    }
  )
    .then((resp) => {
      if (!resp.ok) {
        throw new Error(`Publish failed ${resp.status}: ${resp.text()}`);
      }
      return resp.json();
    })
    .catch((e) => {
      console.error("There was a problem with the fetch operation", e);
    });

  const url = `https://decklog-en.bushiroad.com/view/${data.deck_id}`;
  return url;
}
