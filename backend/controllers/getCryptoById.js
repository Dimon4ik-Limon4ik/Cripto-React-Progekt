import { coinGeckoGet, INVALID_FORMAT_ERROR } from "../services/coinGecko.js";

const COIN_ID_MAX_LENGTH = 100;

// Серверный запрос к CoinGecko API: данные одной монеты (ключ защищён на сервере)
export default async function getCryptoById(req, res) {
  const coinId = String(req.params.coinId || "").trim();

  // Тот же лимит, что в validateFavoriteCoin.js: без него мусорные
  // идентификаторы уходят во внешний API.
  if (!coinId || coinId.length > COIN_ID_MAX_LENGTH) {
    return res.status(400).json({ error: "Некорректный идентификатор монеты" });
  }

  const result = await coinGeckoGet(
    `/coins/markets?vs_currency=usd&ids=${encodeURIComponent(coinId)}`,
  );

  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  if (!Array.isArray(result.data)) {
    return res.status(502).json({ error: INVALID_FORMAT_ERROR });
  }

  // Неизвестная монета — это не ошибка сервера, вернём null.
  res.json(result.data[0] ?? null);
}
