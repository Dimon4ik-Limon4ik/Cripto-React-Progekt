// Серверный запрос к CoinGecko API: история цены для графика (ключ защищён на сервере)
export default async function getCryptoMarketChart(req, res) {
  try {
    const coinId = String(req.params.coinId || "").trim();
    const requestedDays = Number.parseInt(req.query.days, 10);
    // CoinGecko Demo отдаёт не больше 365 дней — ограничиваем период.
    const days = Number.isInteger(requestedDays)
      ? Math.min(Math.max(requestedDays, 1), 365)
      : 1;

    if (!coinId) {
      return res.status(400).json({ error: "Не указан идентификатор монеты" });
    }

    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
      coinId,
    )}/market_chart?vs_currency=usd&days=${days}&x_cg_demo_api_key=${process.env.COINGECKO_API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Ошибка CoinGecko API: HTTP ${response.status}`,
      });
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.prices)) {
      return res.status(502).json({ error: "Некорректный формат данных от CoinGecko" });
    }

    res.json({ prices: data.prices });
  } catch (err) {
    console.error("Ошибка запроса к CoinGecko:", err);
    res.status(502).json({ error: "Не удалось получить данные от CoinGecko" });
  }
}
