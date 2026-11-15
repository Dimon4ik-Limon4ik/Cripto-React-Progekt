import { useContext, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CriptoContext } from "../../Context/CriptoContext.js";
import { ThemeContext } from "../../Context/SunMoonContext.js";
import {
  getCryptoById,
  getCryptoDailyHistory,
  getCryptoMarketChart,
} from "../../Services/Services.js";
import PriceChart from "./PriceChart/PriceChart.jsx";
import { formatPercent, formatPrice } from "./formatPrice.js";
import "./CoinPage.css";

const RANGES = [
  { key: "1d", label: "24 часа", period: "за 24 часа", days: 1 },
  { key: "7d", label: "7 дней", period: "за 7 дней", days: 7 },
  { key: "30d", label: "30 дней", period: "за 30 дней", days: 30 },
  { key: "1y", label: "1 год", period: "за 1 год", days: 365 },
  { key: "6y", label: "6 лет", period: "за 6 лет", days: 2190 },
];

export default function CoinPage() {
  const { coinId } = useParams();
  const crypta = useContext(CriptoContext);
  const { theme } = useContext(ThemeContext);
  const coinFromContext = (crypta || []).find((coin) => coin.id === coinId);

  const [fetchedCoin, setFetchedCoin] = useState(null);
  const [coinError, setCoinError] = useState(false);
  const [rangeKey, setRangeKey] = useState("1d");
  const [chartData, setChartData] = useState([]);
  const [chartStatus, setChartStatus] = useState("loading");
  const [retryToken, setRetryToken] = useState(0);
  const chartCacheRef = useRef(new Map());

  const coin = coinFromContext || fetchedCoin;
  const activeRange =
    RANGES.find((range) => range.key === rangeKey) ?? RANGES[0];

  useEffect(() => {
    if (coinFromContext) return undefined;

    let cancelled = false;
    setCoinError(false);

    getCryptoById(coinId).then((data) => {
      if (cancelled) return;

      if (!data) {
        setCoinError(true);
        return;
      }

      setFetchedCoin(data);
    });

    return () => {
      cancelled = true;
    };
  }, [coinId, coinFromContext]);

  const symbol = coin?.symbol;

  useEffect(() => {
    if (!coinId) return undefined;
    if (rangeKey === "6y" && !symbol) return undefined;

    let cancelled = false;
    const cacheKey = `${coinId}:${rangeKey}`;
    const cachedPromise = chartCacheRef.current.get(cacheKey);

    setChartStatus("loading");
    setChartData([]);

    const requestPromise =
      cachedPromise ||
      (rangeKey === "6y"
        ? getCryptoDailyHistory(symbol, activeRange.days)
        : getCryptoMarketChart(coinId, activeRange.days));

    if (!cachedPromise) {
      chartCacheRef.current.set(cacheKey, requestPromise);
    }

    requestPromise.then((prices) => {
      const hasHistory = Boolean(prices && prices.length >= 2);

      if (!hasHistory) {
        chartCacheRef.current.delete(cacheKey);
      }

      if (cancelled) return;

      if (!hasHistory) {
        setChartStatus("error");
        return;
      }

      setChartData(prices);
      setChartStatus("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [activeRange.days, coinId, rangeKey, retryToken, symbol]);

  const firstPrice = chartData[0]?.[1];
  const lastPrice = chartData[chartData.length - 1]?.[1];
  const changeAbsolute =
    Number.isFinite(firstPrice) && Number.isFinite(lastPrice)
      ? lastPrice - firstPrice
      : null;
  const changePercent =
    changeAbsolute !== null && firstPrice !== 0
      ? (changeAbsolute / firstPrice) * 100
      : null;
  const isGrowth = (changeAbsolute ?? 0) >= 0;
  const isChartReady = chartStatus === "ready" && changeAbsolute !== null;

  return (
    <section className={`coinPage ${theme ? "" : "coinPage-dark"}`}>
      {!coin ? (
        <div className="coinState">
          {coinError ? (
            <>
              <p className="coinStateTitle">Не удалось загрузить монету</p>
              <p className="coinStateText">
                Проверьте подключение к интернету и обновите страницу.
              </p>
            </>
          ) : (
            <>
              <span className="coinStateSpinner" />
              <p className="coinStateText">Загружаем данные...</p>
            </>
          )}
        </div>
      ) : (
        <>
          <header className="coinHeader">
            <div className="coinIdentity">
              <img className="coinIcon" src={coin.image} alt={coin.name} />
              <div className="coinTitleGroup">
                <h1 className="coinName">{coin.name}</h1>
                <span className="coinSymbol">
                  {coin.symbol?.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="coinPriceBlock">
              <div className="coinPriceRow">
                <p className="coinPrice">${formatPrice(coin.current_price)}</p>
                <span className="coinCurrency">USD</span>
              </div>
              <p
                className={`coinChange ${
                  isChartReady
                    ? isGrowth
                      ? "coinChange-growth"
                      : "coinChange-fall"
                    : "coinChange-neutral"
                }`}
              >
                {isChartReady && (
                  <>
                    <span className="coinChangeArrow">
                      {isGrowth ? "↑" : "↓"}
                    </span>
                    <span>
                      {isGrowth ? "+" : "-"}
                      {formatPrice(Math.abs(changeAbsolute))}
                    </span>
                    <span>({formatPercent(changePercent)})</span>
                  </>
                )}
                <span className="coinChangePeriod">{activeRange.period}</span>
              </p>
            </div>
          </header>

          <div className="coinControls">
            <div
              className="coinRangeSwitch"
              role="group"
              aria-label="Период графика"
            >
              {RANGES.map((range) => (
                <button
                  key={range.key}
                  type="button"
                  className={`coinRangeBtn ${
                    range.key === rangeKey ? "coinRangeBtn-active" : ""
                  }`}
                  onClick={() => setRangeKey(range.key)}
                  aria-pressed={range.key === rangeKey}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <span className="coinDataSource">
              Данные: CoinGecko{rangeKey === "6y" ? " · Binance" : ""}
            </span>
          </div>

          <div className="coinChartArea">
            {chartStatus === "loading" && (
              <div className="coinChartMessage">
                <span className="coinStateSpinner" />
                <span>Загружаем график...</span>
              </div>
            )}

            {chartStatus === "error" && (
              <div className="coinChartMessage">
                <span>
                  {rangeKey === "6y"
                    ? "Не удалось загрузить историю за 6 лет для этой монеты."
                    : "Не удалось загрузить историю за этот период."}
                </span>
                <button
                  type="button"
                  className="coinRetryBtn"
                  onClick={() => setRetryToken((value) => value + 1)}
                >
                  Попробовать снова
                </button>
              </div>
            )}

            {chartStatus === "ready" && (
              <PriceChart
                key={`${coinId}-${rangeKey}-${retryToken}`}
                data={chartData}
                theme={theme}
                rangeKey={rangeKey}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}
