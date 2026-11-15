// Серверный запрос к CoinGecko API (API-ключ защищён на сервере)
export default async function getCryptoMarkets(req, res) {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&x_cg_demo_api_key=${process.env.COINGECKO_API_KEY}`;

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

    res.json(data);
  } catch (err) {
    console.error("Ошибка запроса к CoinGecko:", err);
    res.status(502).json({ error: "Не удалось получить данные от CoinGecko" });
  }
}