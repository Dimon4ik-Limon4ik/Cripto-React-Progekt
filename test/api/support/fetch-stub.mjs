// Заглушка внешнего CoinGecko для детерминированных тестов.
// Загружается в процесс бэкенда через `node --import ...`: прод-код не меняется,
// но реальные сетевые запросы к CoinGecko в тестах не выполняются.
const realFetch = globalThis.fetch.bind(globalThis);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeMarkets() {
  return Array.from({ length: 12 }, (_, index) => ({
    id: `stub-coin-${index}`,
    symbol: `S${index}`,
    name: `Stub Coin ${index}`,
    current_price: 100 + index,
    market_cap: 1_000_000 - index * 1000,
    price_change_percentage_24h: (index - 6) * 1.5,
    total_volume: 500_000 - index * 1000,
    high_24h: 105 + index,
    low_24h: 95 + index,
    ath: 200 + index,
    ath_date: "2024-03-14T00:00:00.000Z",
    // Картинка-заглушка в data-URI: браузер в UI-тестах не ходит в сеть.
    image:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  }));
}

globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input?.url ?? String(input);

  // Всё, что не CoinGecko, идёт как есть (localhost-запросы тестов).
  if (!url.startsWith("https://api.coingecko.com/")) {
    return realFetch(input, init);
  }

  const parsed = new URL(url);
  const ids = parsed.searchParams.get("ids");

  if (parsed.pathname === "/api/v3/coins/markets") {
    if (ids === "stub-429") {
      return json({ error: "stub rate limit" }, 429);
    }
    if (ids === "stub-500") {
      return json({ error: "stub internal error" }, 500);
    }
    if (ids === "stub-bad-format") {
      return json({ not: "array" }, 200);
    }
    if (ids === "stub-network") {
      throw new TypeError("fetch failed (stub)");
    }
    if (ids === "stub-unknown") {
      return json([], 200);
    }
    if (ids) {
      const coin = makeMarkets().find((item) => item.id === ids);
      return json(coin ? [coin] : [], 200);
    }
    return json(makeMarkets(), 200);
  }

  const chartMatch = parsed.pathname.match(/^\/api\/v3\/coins\/([^/]+)\/market_chart$/);

  if (chartMatch) {
    const coinId = decodeURIComponent(chartMatch[1]);
    const daysParam = Number(parsed.searchParams.get("days"));

    if (coinId === "stub-429") {
      return json({ error: "stub rate limit" }, 429);
    }
    if (coinId === "stub-500") {
      return json({ error: "stub internal error" }, 500);
    }
    if (coinId === "stub-bad-format") {
      return json({ prices: "nope" }, 200);
    }
    if (coinId === "stub-network") {
      throw new TypeError("fetch failed (stub)");
    }

    // Количество точек равно days: тест проверяет ограничение периода.
    const points = Number.isInteger(daysParam) && daysParam > 0 ? daysParam : 1;
    const prices = Array.from({ length: points }, (_, index) => [
      1730000000000 + index * 86_400_000,
      100 + index,
    ]);

    return json({ prices }, 200);
  }

  return json({ error: "stub: unknown CoinGecko path" }, 404);
};
