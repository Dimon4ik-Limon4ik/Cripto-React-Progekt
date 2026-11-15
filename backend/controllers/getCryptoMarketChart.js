import { coinGeckoGet, INVALID_FORMAT_ERROR } from "../services/coinGecko.js";

const COIN_ID_MAX_LENGTH = 100;

// Серверный запрос к CoinGecko API: история цены для графика (ключ защищён на сервере)
export default async function getCryptoMarketChart(req, res) {
  const coinId = String(req.params.coinId || "").trim();
  const requestedDays = Number.parseInt(req.query.days, 10);
  // CoinGecko Demo отдаёт не больше 365 дней — ограничиваем период.
  const days = Number.isInteger(requestedDays)
    ? Math.min(Math.max(requestedDays, 1), 365)
    : 1;

  // Тот же лимит, что в validateFavoriteCoin.js: без него мусорные
  // идентификаторы уходят во внешний API.
  if (!coinId || coinId.length > COIN_ID_MAX_LENGTH) {
    return res.status(400).json({ error: "Некорректный идентификатор монеты" });
  }

  const result = await coinGeckoGet(
    `/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}`,
  );

  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  if (!result.data || !Array.isArray(result.data.prices)) {
    return res.status(502).json({ error: INVALID_FORMAT_ERROR });
  }

  res.json({ prices: result.data.prices });
}
