// Серверный контроллер — получает топ-10 криптовалют по падению за 24ч
export default async function getTopLosers(req, res) {
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

    // Сортируем по возрастанию изменения цены за 24ч (самые отрицательные) и берём топ-10
    const topLosers = data
      .filter((coin) => coin.price_change_percentage_24h != null)
      .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
      .slice(0, 10);

    res.json(topLosers);
  } catch (err) {
    console.error("Ошибка запроса к CoinGecko:", err);
    res.status(502).json({ error: "Не удалось получить данные от CoinGecko" });
  }
}