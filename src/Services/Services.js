// Ключ CoinGecko хранится только на сервере (secrets/.env).
// Клиент обращается к серверному прокси, поэтому в бандл секреты не попадают.
const CRYPTO_API = "http://localhost:3000/crypto";

export async function getCryptoMarkets() {
  try {
    const url = `${CRYPTO_API}/markets`;

    const response = await fetch(url).catch(() => {
      throw new Error("NETWORK_ERROR");
    });

    if (!response.ok) {
      throw new Error(`HTTP_ERROR_${response.status}`);
    }

    const data = await response.json().catch(() => {
      throw new Error("PARSE_ERROR");
    });

    if (!Array.isArray(data)) {
      throw new Error("INVALID_DATA_FORMAT");
    }

    return data;
  } catch (err) {
    console.log(`В файле "Services.js" ошибка: ${err}`);
    return [];
  }
}

// Топ-10 криптовалют по росту за 24 часа
export async function getTopGainers() {
  try {
    const url = `${CRYPTO_API}/top-gainers`;

    const response = await fetch(url).catch(() => {
      throw new Error("NETWORK_ERROR");
    });

    if (!response.ok) {
      throw new Error(`HTTP_ERROR_${response.status}`);
    }

    const data = await response.json().catch(() => {
      throw new Error("PARSE_ERROR");
    });

    if (!Array.isArray(data)) {
      throw new Error("INVALID_DATA_FORMAT");
    }

    return data
      .filter((coin) => coin.price_change_percentage_24h != null)
      .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
      .slice(0, 10);
  } catch (err) {
    console.log(`В файле "Services.js" ошибка: ${err}`);
    return [];
  }
}

// Топ-10 криптовалют по падению за 24 часа
export async function getTopLosers() {
  try {
    const url = `${CRYPTO_API}/top-losers`;

    const response = await fetch(url).catch(() => {
      throw new Error("NETWORK_ERROR");
    });

    if (!response.ok) {
      throw new Error(`HTTP_ERROR_${response.status}`);
    }

    const data = await response.json().catch(() => {
      throw new Error("PARSE_ERROR");
    });

    if (!Array.isArray(data)) {
      throw new Error("INVALID_DATA_FORMAT");
    }

    return data
      .filter((coin) => coin.price_change_percentage_24h != null)
      .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
      .slice(0, 10);
  } catch (err) {
    console.log(`В файле "Services.js" ошибка: ${err}`);
    return [];
  }
}

const BINANCE_API = "https://data-api.binance.vision/api/v3";

// Данные одной монеты — нужны при прямой загрузке страницы /coin/:id
export async function getCryptoById(coinId) {
  try {
    const url = `${CRYPTO_API}/coin/${encodeURIComponent(coinId)}`;

    const response = await fetch(url).catch(() => {
      throw new Error("NETWORK_ERROR");
    });

    if (!response.ok) {
      throw new Error(`HTTP_ERROR_${response.status}`);
    }

    const data = await response.json().catch(() => {
      throw new Error("PARSE_ERROR");
    });

    // Сервер возвращает null, если монета с таким id не найдена.
    if (data === null) {
      return null;
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("INVALID_DATA_FORMAT");
    }

    return data;
  } catch (err) {
    console.log(`В файле "Services.js" ошибка: ${err}`);
    return null;
  }
}

// История цены для графика за 1–365 дней (CoinGecko Demo).
export async function getCryptoMarketChart(coinId, days) {
  try {
    const url = `${CRYPTO_API}/chart/${encodeURIComponent(
      coinId,
    )}?days=${days}`;

    const response = await fetch(url).catch(() => {
      throw new Error("NETWORK_ERROR");
    });

    if (!response.ok) {
      throw new Error(`HTTP_ERROR_${response.status}`);
    }

    const data = await response.json().catch(() => {
      throw new Error("PARSE_ERROR");
    });

    if (!data || !Array.isArray(data.prices)) {
      throw new Error("INVALID_DATA_FORMAT");
    }

    return data.prices;
  } catch (err) {
    console.log(`В файле "Services.js" ошибка: ${err}`);
    return null;
  }
}

// CoinGecko Demo отдаёт не больше 365 дней, поэтому длинную историю
// (переключатель «6 лет») берём дневными свечами Binance.
async function loadBinanceDailyCandles(pair, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const pages = [];
  let endTime = null;

  for (let page = 0; page < 4; page += 1) {
    const params = new URLSearchParams({
      symbol: pair,
      interval: "1d",
      limit: "1000",
    });

    if (endTime) params.set("endTime", String(endTime));

    const response = await fetch(
      `${BINANCE_API}/klines?${params.toString()}`,
    ).catch(() => {
      throw new Error("NETWORK_ERROR");
    });

    if (!response.ok) {
      throw new Error(`HTTP_ERROR_${response.status}`);
    }

    const batch = await response.json().catch(() => {
      throw new Error("PARSE_ERROR");
    });

    if (!Array.isArray(batch) || batch.length === 0) {
      throw new Error("INVALID_DATA_FORMAT");
    }

    pages.unshift(batch);

    const oldestOpenTime = Number(batch[0][0]);

    if (
      !Number.isFinite(oldestOpenTime) ||
      oldestOpenTime <= cutoff ||
      batch.length < 1000
    ) {
      break;
    }

    endTime = oldestOpenTime - 1;
  }

  const points = pages
    .flat()
    .map((candle) => [Number(candle[0]), Number(candle[4])])
    .filter(
      ([timestamp, price]) =>
        Number.isFinite(timestamp) && Number.isFinite(price) && price > 0,
    )
    .sort((a, b) => a[0] - b[0]);

  const uniquePoints = points.filter(
    (point, index) => index === 0 || point[0] !== points[index - 1][0],
  );

  const history = uniquePoints.filter(([timestamp]) => timestamp >= cutoff);

  return history.length >= 2 ? history : null;
}

// Длинная дневная история (до 6 лет) для монеты по её тикеру.
export async function getCryptoDailyHistory(symbol, days) {
  const base = String(symbol || "").toUpperCase();

  if (!/^[A-Z0-9]{2,12}$/.test(base)) {
    return null;
  }

  const pairs = [`${base}USDT`, `${base}USDC`];

  for (const pair of pairs) {
    try {
      const history = await loadBinanceDailyCandles(pair, days);

      if (history) return history;
    } catch (err) {
      console.log(`Binance ${pair}: ${err}`);
    }
  }

  return null;
}

