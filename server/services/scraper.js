import Card from "../cards/card.js";

export async function getBushiDeck(url) {
  const { id, base, apiLang } = parseViewUrl(url);
  const apiUrl = `${base}/system/${apiLang}/api/view/${id}`;

  let data
  try {
     data = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Origin: base,
        Referer: `${base}/view/${id}`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    })
      .then((resp) => {
        if (!resp.ok) {
          throw new Error(`Upstream error: ${resp.status}`);
        }
        return resp.json();
      });
} catch (error) {
  throw new Error("Fetch failed", e);
}


  if (Array.isArray(data) && data.length === 0) {
    throw new Error("Invalid deck ID (deck does not exist)");
  }
  const cards = [];
  const title = data.title;
  const cardList = [...data.list, ...data.sub_list, ...data.p_list];
  for (const c of cardList) {
    cards.push(
      new Card({
        card_name: c.name || "",
        card_id: c.card_number || "",
        quantity: c.num || 1,
      })
    );
  }

  return { deck: cards, title };
}

function parseViewUrl(viewUrl) {
  const u = new URL(viewUrl);
  const host = u.hostname;
  const apiLang = u.pathname.startsWith("/ja") ? `app-ja` : `app`;
  if (!["decklog-en.bushiroad.com", "decklog.bushiroad.com"].includes(host)) {
    throw new Error("Not a decklog URL");
  }
  const m = /^\/(?:ja\/)?view\/([A-Za-z0-9_-]{4,32})$/.exec(u.pathname);
  if (!m) {
    throw new Error("Decklog URL must be /view/<deckId> or /ja/view/<deckId>");
  }

  return { id: m[1], base: `https://${host}`, apiLang };
}
