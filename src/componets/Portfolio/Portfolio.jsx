import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CriptoContext } from "../../Context/CriptoContext.js";
import { ThemeContext } from "../../Context/SunMoonContext.js";
import { useFavorites } from "../../Context/FavoritesContext.jsx";
import { formatPercent, formatPrice } from "../CoinPage/formatPrice.js";
import PriceChart from "../CoinPage/PriceChart/PriceChart.jsx";
import PortfolioCard from "./PortfolioCard.jsx";
import useCoinHistory from "./useCoinHistory.js";
import {
  formatCompactMoney,
  formatMoney,
  formatShortDate,
} from "./formatPortfolio.js";
import "./Portfolio.css";

const RANGES = [
  { key: "1d", label: "24 часа", period: "за 24 часа", days: 1, mode: "market" },
  { key: "7d", label: "7 дней", period: "за 7 дней", days: 7, mode: "market" },
  {
    key: "30d",
    label: "30 дней",
    period: "за 30 дней",
    days: 30,
    mode: "market",
  },
  { key: "1y", label: "1 год", period: "за 1 год", days: 365, mode: "market" },
  {
    key: "6y",
    label: "6 лет",
    period: "за 6 лет",
    days: 2190,
    mode: "daily",
  },
];

export default function Portfolio() {
  const crypta = useContext(CriptoContext);
  const { theme } = useContext(ThemeContext);
  const { favoriteIds } = useFavorites();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState(null);
  const [rangeKey, setRangeKey] = useState("1d");

  const coins = Array.isArray(crypta) ? crypta : [];
  const isCryptoLoading = coins.length === 0;
  const favoriteCoins = favoriteIds
    .map((coinId) => coins.find((coin) => coin.id === coinId))
    .filter(Boolean);
  const activeCoin =
    favoriteCoins.find((coin) => coin.id === selectedId) ||
    favoriteCoins[0] ||
    null;
  const activeRange =
    RANGES.find((range) => range.key === rangeKey) || RANGES[0];

  const chart = useCoinHistory(
    activeCoin?.id,
    activeCoin?.symbol,
    activeRange.days,
    activeRange.mode,
  );

  const firstPrice = chart.data[0]?.[1];
  const lastPrice = chart.data[chart.data.length - 1]?.[1];
  const changeAbsolute =
    Number.isFinite(firstPrice) && Number.isFinite(lastPrice)
      ? lastPrice - firstPrice
      : null;
  const changePercent =
    changeAbsolute !== null && firstPrice !== 0
      ? (changeAbsolute / firstPrice) * 100
      : null;
  const isGrowth = (changeAbsolute ?? 0) >= 0;
  const isChartReady = chart.status === "ready" && changeAbsolute !== null;
  const athDate = activeCoin ? formatShortDate(activeCoin.ath_date) : "";

  return (
    <section className={`portfolioPage ${theme ? "" : "portfolioPage-dark"}`}>
      <aside
        className="portfolioFavoritesPanel"
        aria-label="Избранные монеты"
      >
        <header className="portfolioFavoritesHeader">
          <div>
            <p className="portfolioEyebrow">Портфель</p>
            <h1 className="portfolioTitle">Избранное</h1>
          </div>
          <span
            className="portfolioCounter"
            title="Количество монет в портфеле"
          >
            {favoriteCoins.length}
          </span>
        </header>

        <p className="portfolioHint">
          Монеты, которые вы отметили звездой на главной.
        </p>

        <div className="portfolioFavoritesScroll">
          {isCryptoLoading ? (
            <div className="portfolioListState">
              <span className="portfolioSpinner" />
              <span>Загружаем монеты...</span>
            </div>
          ) : favoriteCoins.length === 0 ? (
            <div className="portfolioListState">
              <span>Пока здесь пусто.</span>
              <span>
                Нажмите звёздочку на карточке монеты на главной — она появится
                в портфеле.
              </span>
            </div>
          ) : (
            favoriteCoins.map((coin) => (
              <PortfolioCard
                key={coin.id}
                coin={coin}
                theme={theme}
                selected={activeCoin?.id === coin.id}
                onSelect={setSelectedId}
              />
            ))
          )}
        </div>
      </aside>

      <div className="portfolioDetail">
        {isCryptoLoading ? (
          <section className="portfolioEmpty">
            <span className="portfolioSpinner" />
            <p className="portfolioEmptyText">
              Загружаем данные портфеля...
            </p>
          </section>
        ) : activeCoin ? (
          <>
            <section
              className="portfolioChartPanel"
              aria-label={`График ${activeCoin.name}`}
            >
              <header className="portfolioCoinHeader">
                <div className="portfolioCoinIdentity">
                  <img
                    className="portfolioCoinAvatar"
                    src={activeCoin.image}
                    alt=""
                  />
                  <div className="portfolioCoinTitleGroup">
                    <h2 className="portfolioCoinName">{activeCoin.name}</h2>
                    <span className="portfolioCoinSymbol">
                      {activeCoin.symbol?.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="portfolioPriceBlock">
                  <div className="portfolioPriceRow">
                    <p className="portfolioCoinPrice">
                      {formatMoney(activeCoin.current_price)}
                    </p>
                    <span className="portfolioCoinCurrency">USD</span>
                  </div>
                  <p
                    className={`portfolioCoinChange ${
                      isChartReady
                        ? isGrowth
                          ? "portfolioCoinChange-growth"
                          : "portfolioCoinChange-fall"
                        : "portfolioCoinChange-neutral"
                    }`}
                  >
                    {isChartReady ? (
                      <>
                        <span className="portfolioCoinChangeArrow">
                          {isGrowth ? "↑" : "↓"}
                        </span>
                        <span>
                          {isGrowth ? "+" : "-"}
                          {formatPrice(Math.abs(changeAbsolute))}
                        </span>
                        <span>({formatPercent(changePercent)})</span>
                      </>
                    ) : (
                      <span>—</span>
                    )}
                    <span className="portfolioChangePeriod">
                      {activeRange.period}
                    </span>
                  </p>
                </div>
              </header>

              <div className="portfolioChartControls">
                <div
                  className="portfolioRangeSwitch"
                  role="group"
                  aria-label="Период графика"
                >
                  {RANGES.map((range) => (
                    <button
                      key={range.key}
                      type="button"
                      className={`portfolioRangeBtn ${
                        range.key === rangeKey
                          ? "portfolioRangeBtn-active"
                          : ""
                      }`}
                      onClick={() => setRangeKey(range.key)}
                      aria-pressed={range.key === rangeKey}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>

                <div className="portfolioChartActions">
                  <span className="portfolioDataSource">
                    Данные: CoinGecko
                    {activeRange.mode === "daily" ? " · Binance" : ""}
                  </span>
                  <button
                    type="button"
                    className="portfolioOpenCoin"
                    onClick={() => navigate(`/coin/${activeCoin.id}`)}
                    title="Открыть полную страницу монеты"
                  >
                    Открыть монету
                    <span className="portfolioOpenArrow" aria-hidden="true">
                      →
                    </span>
                  </button>
                </div>
              </div>

              <div className="portfolioChartArea">
                {chart.status === "loading" && (
                  <div className="portfolioChartMessage">
                    <span className="portfolioSpinner" />
                    <span>Загружаем график...</span>
                  </div>
                )}

                {(chart.status === "error" || chart.status === "idle") && (
                  <div className="portfolioChartMessage">
                    <span>
                      {activeRange.mode === "daily"
                        ? "Не удалось загрузить историю за 6 лет для этой монеты."
                        : "Не удалось загрузить историю за этот период."}
                    </span>
                    <button
                      type="button"
                      className="portfolioRetryBtn"
                      onClick={chart.reload}
                    >
                      Попробовать снова
                    </button>
                  </div>
                )}

                {chart.status === "ready" && (
                  <PriceChart
                    key={`${activeCoin.id}-${activeRange.key}`}
                    data={chart.data}
                    theme={theme}
                    rangeKey={activeRange.key}
                  />
                )}
              </div>
            </section>

            <section
              className="portfolioStatsPanel"
              aria-label="Информация о монете"
            >
              <div className="portfolioStatsHeader">
                <h2 className="portfolioStatsTitle">Обзор монеты</h2>
                <span className="portfolioStatsSubtitle">
                  Капитализация, объёмы и рекорды
                </span>
              </div>

              <div className="portfolioStatsGrid">
                <div className="portfolioStatTile">
                  <span className="portfolioStatLabel">Капитализация</span>
                  <span className="portfolioStatValue">
                    {formatCompactMoney(activeCoin.market_cap)}
                  </span>
                </div>

                <div className="portfolioStatTile">
                  <span className="portfolioStatLabel">
                    Объём торгов за 24ч
                  </span>
                  <span className="portfolioStatValue">
                    {formatCompactMoney(activeCoin.total_volume)}
                  </span>
                </div>

                <div className="portfolioStatTile">
                  <span className="portfolioStatLabel">Максимум за 24ч</span>
                  <span className="portfolioStatValue portfolioStatValue-growth">
                    {formatMoney(activeCoin.high_24h)}
                  </span>
                </div>

                <div className="portfolioStatTile">
                  <span className="portfolioStatLabel">Минимум за 24ч</span>
                  <span className="portfolioStatValue portfolioStatValue-fall">
                    {formatMoney(activeCoin.low_24h)}
                  </span>
                </div>

                <div className="portfolioStatTile portfolioStatTile-ath">
                  <span className="portfolioStatLabel">
                    <span
                      className="portfolioStatAthEmoji"
                      aria-hidden="true"
                    >
                      🏆
                    </span>
                    Исторический максимум
                  </span>
                  <span className="portfolioStatValue">
                    {formatMoney(activeCoin.ath)}
                  </span>
                  {athDate ? (
                    <span className="portfolioStatNote">{athDate}</span>
                  ) : null}
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="portfolioEmpty">
            <span className="portfolioEmptyIcon" aria-hidden="true">
              star
            </span>
            <h2 className="portfolioEmptyTitle">В портфеле пока пусто</h2>
            <p className="portfolioEmptyText">
              Откройте главную страницу и нажмите звезду на карточке монеты —
              она появится здесь и будет доступна в портфеле.
            </p>
            <button
              type="button"
              className="portfolioEmptyBtn"
              onClick={() => navigate("/Home")}
            >
              Выбрать монеты
            </button>
          </section>
        )}
      </div>
    </section>
  );
}
