import Star from "../HomePage/CriptoCard/Star.jsx";
import MiniChart from "./MiniChart.jsx";
import useCoinHistory from "./useCoinHistory.js";
import { formatPercent } from "../CoinPage/formatPrice.js";
import {
  formatCompactMoney,
  formatMoney,
  formatShortDate,
} from "./formatPortfolio.js";

export default function PortfolioCard({ coin, theme, selected, onSelect }) {
  const { data, status } = useCoinHistory(coin.id, coin.symbol, 1);
  const change = coin.price_change_percentage_24h;
  const hasChange = Number.isFinite(change);
  const isGrowth = hasChange ? change >= 0 : true;
  const athDate = formatShortDate(coin.ath_date);

  const handleSelect = () => onSelect(coin.id);

  const handleKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    handleSelect();
  };

  return (
    <article
      className={`portfolioCard ${theme ? "" : "portfolioCard-dark"} ${
        selected ? "portfolioCard-selected" : ""
      }`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Показать ${coin.name} в портфеле`}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
    >
      <div className="portfolioCardHead">
        <img
          className="portfolioCardAvatar"
          src={coin.image}
          alt=""
          loading="lazy"
        />

        <div className="portfolioCardIdentity">
          <div className="portfolioCardTitleRow">
            <span className="portfolioCardName">{coin.name}</span>
            <span className="portfolioCardSymbol">
              {coin.symbol?.toUpperCase()}
            </span>
          </div>

          <div className="portfolioCardPriceRow">
            <span className="portfolioCardPrice">
              {formatMoney(coin.current_price)}
            </span>
            <span
              className={`portfolioCardChange ${
                hasChange
                  ? isGrowth
                    ? "portfolioCardChange-growth"
                    : "portfolioCardChange-fall"
                  : "portfolioCardChange-neutral"
              }`}
            >
              {hasChange ? (
                <>
                  <span className="portfolioCardChangeArrow">
                    {isGrowth ? "↑" : "↓"}
                  </span>
                  {formatPercent(change)}
                </>
              ) : (
                "—"
              )}
            </span>
          </div>
        </div>

        <div className="portfolioCardSide">
          <Star CryptaId={coin.id} className="portfolioCardStar" />
          <MiniChart data={data} theme={theme} status={status} />
        </div>
      </div>

      <div className="portfolioCardStats">
        <div className="portfolioCardStat">
          <span className="portfolioCardStatLabel">Капитализация</span>
          <span className="portfolioCardStatValue">
            {formatCompactMoney(coin.market_cap)}
          </span>
        </div>

        <div className="portfolioCardStat">
          <span className="portfolioCardStatLabel">Объём торгов за 24ч</span>
          <span className="portfolioCardStatValue">
            {formatCompactMoney(coin.total_volume)}
          </span>
        </div>

        <div className="portfolioCardStat">
          <span className="portfolioCardStatLabel">Максимум за 24ч</span>
          <span className="portfolioCardStatValue portfolioCardStatValue-growth">
            {formatMoney(coin.high_24h)}
          </span>
        </div>

        <div className="portfolioCardStat">
          <span className="portfolioCardStatLabel">Минимум за 24ч</span>
          <span className="portfolioCardStatValue portfolioCardStatValue-fall">
            {formatMoney(coin.low_24h)}
          </span>
        </div>

        <div className="portfolioCardStat portfolioCardStat-ath">
          <span className="portfolioCardStatLabel">
            <span className="portfolioCardAthEmoji" aria-hidden="true">
              🏆
            </span>
            Исторический максимум
          </span>
          <span className="portfolioCardStatValue">
            {formatMoney(coin.ath)}
            {athDate ? (
              <span className="portfolioCardAthDate">{athDate}</span>
            ) : null}
          </span>
        </div>
      </div>
    </article>
  );
}
