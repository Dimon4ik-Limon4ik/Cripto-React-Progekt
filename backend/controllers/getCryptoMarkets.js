import { coinGeckoGet, INVALID_FORMAT_ERROR } from "../services/coinGecko.js";

const MARKETS_PATH =
  "/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false";

// Серверный запрос к CoinGecko API (API-ключ защищён на сервере)
export default async function getCryptoMarkets(req, res) {
  const result = await coinGeckoGet(MARKETS_PATH);

  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  if (!Array.isArray(result.data)) {
    return res.status(502).json({ error: INVALID_FORMAT_ERROR });
  }

  res.json(result.data);
}