// Идентификаторы CoinGecko состоят из латиницы, цифр и дефисов.
const COIN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/i;

export default function validateFavoriteCoin(req, res, next) {
  const raw = req.params.coinId ?? req.body?.coinId;

  if (typeof raw !== "string") {
    return res.status(400).json({ error: "Не указана монета" });
  }

  const coinId = raw.trim();

  if (!COIN_ID_PATTERN.test(coinId)) {
    return res.status(400).json({ error: "Некорректный идентификатор монеты" });
  }

  req.favoriteCoinId = coinId;
  next();
}