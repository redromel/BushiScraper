const SVE_ID = [6, 106];

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

  const deckId = /^\/(?:ja\/)?view\/([A-Za-z0-9_-]{4,32})$/.exec(
    parsed.pathname
  );
  if (!deckId) {
    return res
      .status(400)
      .send({ error: "URL must be /view/<id> or /ja/view/<id>" });
  }

  let lang;
  if (parsed.hostname === "decklog-en.bushiroad.com") {
    lang = parsed.pathname.startsWith("/ja") ? "jp" : "en";
  } else if (parsed.hostname === "decklog.bushiroad.com") {
    lang = "jp";
  } else {
    return res.status(400).send({
      error: "Must be decklog-en.bushiroad.com or decklog.bushiroad.com",
    });
  }

  req.decklog = {
    deckId: deckId[1],
    host: parsed.hostname,
    url: parsed.toString(),
    lang: lang,
  };

  next();
}

export async function verifyDeckExists(req, res, next) {
  const { deckId, url, host } = req.decklog || {};

  const base = `https://${host}`;
  const parsed = URL.parse(url);
  const apiLang = parsed.pathname.startsWith("/ja") ? `app-ja` : `app`;
  let refererLink = "";
  if (apiLang === "app-ja") {
    refererLink = "/ja";
  }
  const resp = await fetch(
    `https://${host}/system/${apiLang}/api/view/${deckId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: `${base}`,
        Referer: `${base}${refererLink}/view/${deckId}`,
        "User-Agent": "Bushiscraper/1.0 (+github.com/redromel/BushiScraper)",
      },
    }
  );

  const data = await resp.json();

  if (Array.isArray(data) && data.length === 0) {
    return res.status(422).send({ error: "Invalid Deck Code" });
  }
  if (!SVE_ID.includes(data.game_title_id)) {
    return res
      .status(422)
      .send({ error: "Invalid Game:  Must be Shadowverse: Evolved" });
  }

  next();
}


function parseOne(url) {
  const u = new URL(url);

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("bad-proto");
  }

  const m = /^\/(?:ja\/)?view\/([A-Za-z0-9_-]{4,32})$/.exec(u.pathname);
  if (!m) throw new Error("bad-path");

  let lang;
  if (u.hostname === "decklog-en.bushiroad.com") {
    lang = u.pathname.startsWith("/ja") ? "jp" : "en";
  } else if (u.hostname === "decklog.bushiroad.com") {
    lang = "jp";
  } else {
    throw new Error("bad-host");
  }

  return {
    deckId: m[1],
    host: u.hostname,
    url: u.toString(),
    lang,
  };
}

async function fetchOne(decklog) {
  const { deckId, url, host } = decklog;
  const base = `https://${host}`;


  const u = new URL(url);
  const apiLang = u.pathname.startsWith("/ja") ? "app-ja" : "app";
  const refererLink = apiLang === "app-ja" ? "/ja" : "";

  const resp = await fetch(
    `https://${host}/system/${apiLang}/api/view/${deckId}`,
    {
      method: "POST",
      headers: {
        Origin: base,
        Referer: `${base}${refererLink}/view/${deckId}`,
        "User-Agent": "BushiScraper/1.0 (+github.com/redromel/BushiScraper)",
      },
    }
  );

  if (!resp.ok) throw new Error(`upstream-${resp.status}`);

  const data = await resp.json();
  if (Array.isArray(data) && data.length === 0) return null;
  if (!SVE_ID.includes(data.game_title_id)) return null;

  return data;
}



// Accepts either { urls: [a,b] } or { urlA: a, urlB: b }
export function validateLinkPair(req, res, next) {
  const b = req.body || {};
  const urls = Array.isArray(b.urls)
    ? b.urls
    : [b.urlA, b.urlB].filter(Boolean);

  if (urls.length !== 2) {
    return res.status(400).send({
      error: "Provide two URLs via {urls:[a,b]} or {urlA, urlB}",
    });
  }

  try {
    req.decklogs = urls.map(parseOne); // [{deckId, host, url, lang}, ...]
    return next();f
  } catch (e) {
    return res.status(400).send({ error: "Invalid Decklog URL(s)" });
  }
}

export async function verifyBothExist(req, res, next) {
  try {
    const [dataA, dataB] = await Promise.all(
      req.decklogs.map((dl) => fetchOne(dl))
    );

    if (!dataA || !dataB) {
      return res
        .status(422)
        .send({ error: "One or both deck codes invalid or not SVE" });
    }

    // attach for handler
    req.deckDataA = dataA;
    req.deckDataB = dataB;
    return next();
  } catch (e) {
    console.error(e);
    return res.status(502).send({ error: "Verification failed" });
  }
}
