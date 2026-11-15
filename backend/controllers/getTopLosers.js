import { coinGeckoGet, INVALID_FORMAT_ERROR } from "../services/coinGecko.js";

const MARKETS_PATH =
  "/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false";

// Серверный контроллер — получает топ-10 криптовалют по падению за 24ч
export default async function getTopLosers(req, res) {
  const result = await coinGeckoGet(MARKETS_PATH);

  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  if (!Array.isArray(result.data)) {
    return res.status(502).json({ error: INVALID_FORMAT_ERROR });
  }

  // Сортируем по возрастанию изменения цены за 24ч (самые отрицательные) и берём топ-10
  const topLosers = result.data
    .filter((coin) => coin.price_change_percentage_24h != null)
    .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
    .slice(0, 10);

  res.json(topLosers);
}