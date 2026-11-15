import { useCallback, useEffect, useState } from "react";
import {
  getCryptoDailyHistory,
  getCryptoMarketChart,
} from "../../Services/Services.js";

// Общий кеш запросов: карточки и большой график используют один и тот же
// запрос, если у них совпадают монета и период. Promise хранится, чтобы
// StrictMode не отправлял повторный запрос при двойном монтировании.
const historyCache = new Map();

export default function useCoinHistory(coinId, symbol, days, mode = "market") {
  const [reloadToken, setReloadToken] = useState(0);
  const canLoad = Boolean(coinId) && (mode !== "daily" || Boolean(symbol));
  const requestKey = canLoad ? `${mode}:${coinId}:${days}` : "";

  const [state, setState] = useState({
    requestKey: "",
    data: [],
    status: "loading",
  });

  useEffect(() => {
    if (!requestKey) return undefined;

    let cancelled = false;
    let request = historyCache.get(requestKey);

    if (!request) {
      request =
        mode === "daily"
          ? getCryptoDailyHistory(symbol, days)
          : getCryptoMarketChart(coinId, days);
      historyCache.set(requestKey, request);
    }

    setState({ requestKey, data: [], status: "loading" });

    request.then((prices) => {
      const hasHistory = Array.isArray(prices) && prices.length >= 2;

      if (!hasHistory) {
        historyCache.delete(requestKey);
      }

      if (cancelled) return;

      setState({
        requestKey,
        data: hasHistory ? prices : [],
        status: hasHistory ? "ready" : "error",
      });
    });

    return () => {
      cancelled = true;
    };
  }, [coinId, days, mode, reloadToken, requestKey, symbol]);

  const reload = useCallback(() => {
    if (requestKey) {
      historyCache.delete(requestKey);
    }

    setReloadToken((value) => value + 1);
  }, [requestKey]);

  const isActual = requestKey !== "" && state.requestKey === requestKey;

  return {
    data: isActual ? state.data : [],
    status: requestKey ? (isActual ? state.status : "loading") : "idle",
    reload,
  };
}
