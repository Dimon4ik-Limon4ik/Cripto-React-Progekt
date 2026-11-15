// Серверный запрос к CoinGecko API: данные одной монеты (ключ защищён на сервере)
export default async function getCryptoById(req, res) {
  try {
    const coinId = String(req.params.coinId || "").trim();

    if (!coinId) {
      return res.status(400).json({ error: "Не указан идентификатор монеты" });
    }

    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(
      coinId,
    )}&x_cg_demo_api_key=${process.env.COINGECKO_API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Ошибка CoinGecko API: HTTP ${response.status}`,
      });
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      return res.status(502).json({ error: "Некорректный формат данных от CoinGecko" });
    }

    // Неизвестная монета — это не ошибка сервера, вернём null.
    res.json(data[0] ?? null);
  } catch (err) {
    console.error("Ошибка запроса к CoinGecko:", err);
    res.status(502).json({ error: "Не удалось получить данные от CoinGecko" });
  }
}
