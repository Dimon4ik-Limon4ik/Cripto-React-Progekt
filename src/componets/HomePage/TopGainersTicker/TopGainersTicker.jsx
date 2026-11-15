import { useContext, useMemo } from "react";
import { ThemeContext } from "./../../../Context/SunMoonContext.js";
import { CriptoContext } from "./../../../Context/CriptoContext.js";
import "./../CriptoCard/CriptoCard.css";
import "./TopGainersTicker.css";

export default function TopGainersTicker() {
  const { theme } = useContext(ThemeContext);
  const crypta = useContext(CriptoContext);

  // Берём данные из общего контекста (их уже загружает BackgroundLayout),
  // чтобы не дублировать запросы к CoinGecko и не зависеть от токена.
  const coins = useMemo(
    () =>
      [...(crypta || [])]
        .filter((coin) => coin?.price_change_percentage_24h != null)
        .sort(
          (a, b) =>
            b.price_change_percentage_24h - a.price_change_percentage_24h,
        )
        .slice(0, 10),
    [crypta],
  );

  if (coins.length === 0) return null;

  // Дублируем массив для бесшовной прокрутки
  const doubledCoins = [...coins, ...coins];

  return (
    <div className="tickerContainer">
      <div className="tickerHeader">
        <span className="tickerFire">🔥</span>
        <span className={`tickerTitle ${theme ? "" : "tickerTitle-dark"}`}>
          Топ 10 рост за 24 часа
        </span>
      </div>
      <div className="tickerTrackWrapper">
        <div className="tickerTrack">
          {doubledCoins.map((coin, index) => (
            <div
              key={`${coin.id}-${index}`}
              className={`tickerCard Card ${theme ? "" : "Card-dark"}`}
            >
              <img
                src={coin.image}
                alt={coin.symbol}
                className="tickerCardImg"
              />
              <div className="tickerCardInfo">
                <span
                  className={`tickerCardName ${theme ? "" : "tickerCardName-dark"}`}
                  style={
                    coin.name.length > 14
                      ? { fontSize: "14px" }
                      : coin.name.length > 10
                      ? { fontSize: "16px" }
                      : {}
                  }
                >
                  {coin.name}
                </span>
                <span className="tickerCardChange CryptoGrowth">
                  {coin.price_change_percentage_24h > 0 ? "+" : ""}
                  {coin.price_change_percentage_24h?.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}