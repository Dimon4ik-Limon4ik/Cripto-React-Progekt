import { coinGeckoGet, INVALID_FORMAT_ERROR } from "../services/coinGecko.js";

const MARKETS_PATH =
  "/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false";

// Серверный контроллер — получает топ-10 криптовалют по росту за 24ч
export default async function getTopGainers(req, res) {
  const result = await coinGeckoGet(MARKETS_PATH);

  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  if (!Array.isArray(result.data)) {
    return res.status(502).json({ error: INVALID_FORMAT_ERROR });
  }

  // Сортируем по убыванию изменения цены за 24ч и берём топ-10
  const topGainers = result.data
    .filter((coin) => coin.price_change_percentage_24h != null)
    .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
    .slice(0, 10);

  res.json(topGainers);
}