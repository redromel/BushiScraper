const SVE_ID = [6, 106];

export function validateLink(ctx) {
  const { body, set } = ctx;
  const { url } = body;

  if (!url || typeof url !== "string") {
    set.status = 400;
    return { error: "No 'url' in text body" };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    set.status = 400;
    return { error: "Invalid URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    set.status = 400;
    return { error: "URL must be http(s)" };
  }

  const deckId = /^\/(?:ja\/)?view\/([A-Za-z0-9_-]{4,32})$/.exec(
    parsed.pathname
  );
  if (!deckId) {
    set.status = 400;
    return { error: "URL must be /view/<id> or /ja/view/<id>" };
  }

  let lang;
  if (parsed.hostname === "decklog-en.bushiroad.com") {
    lang = parsed.pathname.startsWith("/ja") ? "jp" : "en";
  } else if (parsed.hostname === "decklog.bushiroad.com") {
    lang = "jp";
  } else {
    set.status = 400;
    return {
      error: "Must be decklog-en.bushiroad.com or decklog.bushiroad.com",
    };
  }

  ctx.decklog = {
    deckId: deckId[1],
    host: parsed.hostname,
    url: parsed.toString(),
    lang: lang,
  };
}

export async function verifyDeckExists(ctx) {
  const { set, decklog } = ctx;
  const { deckId, url, host } = decklog || {};
  console.log(decklog);
  const base = `https://${host}`;
  const parsed = new URL(url);
  const apiLang = parsed.pathname.startsWith("/ja") ? `app-ja` : `app`;
  let refererLink = "";
  if (apiLang === "app-ja") {
    refererLink = "/ja";
  }

  let data;
  try {
    data = await fetch(`https://${host}/system/${apiLang}/api/view/${deckId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: `${base}`,
        Referer: `${base}${refererLink}/view/${deckId}`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    }).then((resp) => {
      if (!resp.ok) {
        throw new Error(`Upstream error: ${resp.status}`);
      }
      return resp.json();
    });
  } catch (error) {
    console.error("Fetch failed", e);
    set.status = 502;
    return { error: "Failed to reach Decklog API" };
  }

  if (Array.isArray(data) && data.length === 0) {
    set.status = 422;
    return { error: "Invalid Deck Code" };
  }
  if (!SVE_ID.includes(data.game_title_id)) {
    set.status = 422;
    return { error: "Invalid Game:  Must be Shadowverse: Evolved" };
  }
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
export function validateLinkPair(ctx) {
  const { body, set } = ctx;
  const b = body || {};
  const urls = Array.isArray(b.urls)
    ? b.urls
    : [b.urlA, b.urlB].filter(Boolean);

  if (urls.length !== 2) {
    set.status = 400;
    return {
      error: "Provide two URLs via {urls:[a,b]} or {urlA, urlB}",
    };
  }

  try {
    const parsed = urls.map(parseDecklogUrl);
    ctx.decklogs = parsed; // [{ deckId, host, url, lang }, { ... }]
  } catch (e) {
    set.status = 400;
    return { error: "Invalid Decklog URL(s)" };
  }
}

export async function verifyBothExist(ctx) {
  const { set, decklogs } = ctx;
  try {
    const [dataA, dataB] = await Promise.all([
      fetchOne(decklogs[0]),
      fetchOne(decklogs[1]),
    ]);

    if (!dataA || !dataB) {
      set.status = 422;
      return { error: "One or both deck codes invalid or not SVE" };
    }

    ctx.deckDataA = dataA;
    ctx.deckDataB = dataB;
    return next();
  } catch (e) {
    console.error(e);
    set.status = 502;
    return { error: "Verification failed" };
  }
}

export const mw =
  (...fns) =>
  async (ctx) => {
    for (const fn of fns) {
      const out = await fn(ctx);
      if (out !== undefined) return out;
    }
  };

function parseDecklogUrl(input) {
  if (typeof input !== "string" || !input.trim()) throw new Error("bad-url");
  const url = input.trim();

  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error("bad-url");
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("bad-proto");
  }
}
