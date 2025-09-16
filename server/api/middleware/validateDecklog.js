const SVE_ID = 6

export function validateLink(req, res, next) {
  const { url } = req.body || {};

  if (!url || typeof url !== "string") {
    return res.status(400).send({ error: "No 'url' in text body" });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).send({ error: "Invalid URL" });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return res.status(400).send({ error: "URL must be http(s)" });
  }

  if (parsed.hostname !== "decklog.bushiroad.com") {
    return res
      .status(400)
      .send({ error: "Must be a JP Decklog (decklog.bushiroad.com)" });
  }

  const deckId = /^\/view\/([A-Za-z0-9_-]{4,32})$/.exec(parsed.pathname);

  if (!deckId) {
    return res.status(400).send({ error: "URL path must be view/<deckId>" });
  }

  req.decklog = {
    deckId: deckId[1],
    host: parsed.hostname,
    url: parsed.toString(),
  };

  next();
}

export async function verifyDeckExists(req, res, next) {
  const { deckId, url, host } = req.decklog || {};
  const base = `https://${host}`;
  console.log(`${base}/system/api/view/${deckId}`);
  const resp = await fetch(`https://${host}/system/app/api/view/${deckId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: `${base}`,
      Referer: `${base}/view/${deckId}`,
      "User-Agent": "Bushiscraper/1.0 (+github.com/redromel/BushiScraper)",
    },
  });

  const data = await resp.json();

  if (Array.isArray(data) && data.length === 0) {
    return res.status(422).send({error:  "Invalid Deck Code"});
  }
  if(data.game_title_id !== SVE_ID){

    return res.status(422).send({error: "Invalid Game:  Must be Shadowverse: Evolved"})
  } 

  
  next();
}
