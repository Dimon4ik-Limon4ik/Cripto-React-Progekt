// Сетевые подмены UI-тестов:
//  1) absolute-URL http://localhost:3000/* переписываются на same-origin
//     /__e2e-api/* до вызова fetch (Vite проксирует их на тестовый бэкенд);
//  2) графики и Binance отдаются детерминированными заглушками;
//  3) любой другой внешний запрос блокируется — реальные API не вызываются.
import { FRONTEND_PORT, PROXY_PREFIX, TEST_EMAIL_DOMAIN } from "./env.mjs";

const CHART_OVERRIDE_EXCEPTIONS = new Set(["stub-429", "stub-bad-format", "stub-network"]);

export function makePrices(count, startPrice = 100) {
  const points = [];

  for (let index = 0; index < count; index += 1) {
    points.push([
      1_730_000_000_000 + index * 3_600_000,
      startPrice + index * 0.75,
    ]);
  }

  return points;
}

export function makeKlines(count = 400) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const candles = [];

  for (let index = count - 1; index >= 0; index -= 1) {
    const openTime = now - index * day;
    const close = 100 + (count - index) * 0.5;

    candles.push([
      openTime,
      String(close - 1),
      String(close + 1),
      String(close - 2),
      String(close),
      "10",
      openTime + day - 1,
      "1000",
      42,
      "5",
      "500",
      "0",
    ]);
  }

  return candles;
}

// Переписывание абсолютных URL ещё до fetch: запрос сразу уходит на тот же
// origin, поэтому CORS-preflight не нужен и dev-сервер на localhost:3000
// (если он запущен у разработчика) не затрагивается.
export async function installApiRewrite(context) {
  await context.addInitScript(
    ({ prefix }) => {
      const API_ORIGIN = "http://localhost:3000";
      const nativeFetch = window.fetch.bind(window);

      window.fetch = (input, init) => {
        let url =
          typeof input === "string"
            ? input
            : input instanceof Request
              ? input.url
              : String(input);

        if (url.startsWith(`${API_ORIGIN}/`)) {
          url = `${window.location.origin}${prefix}${url.slice(API_ORIGIN.length)}`;
          return nativeFetch(url, init);
        }

        return nativeFetch(input, init);
      };
    },
    { prefix: PROXY_PREFIX },
  );
}

export async function installStubs(context, options = {}) {
  const { chartPoints, marketsStatus = 0 } = options;

  // Регистрируем от последнего к первому: Playwright матчит маршруты
  // в обратном порядке регистрации.
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const isDevServer = url.hostname === "127.0.0.1" && url.port === String(FRONTEND_PORT);

    if (isDevServer) {
      return route.continue();
    }

    // Всё внешнее (включая data-api.binance.vision и любые CDN) — блокируем,
    // чтобы тесты не зависели от сети.
    return route.abort();
  });

  await context.route("https://data-api.binance.vision/**", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(makeKlines()),
    });
  });

  await context.route(`**${PROXY_PREFIX}/crypto/chart/**`, async (route) => {
    const url = new URL(route.request().url());
    const coinId = decodeURIComponent(url.pathname.split("/").pop() ?? "");

    if (CHART_OVERRIDE_EXCEPTIONS.has(coinId)) {
      return route.continue();
    }

    const days = Number.parseInt(url.searchParams.get("days"), 10) || 1;
    const count = Math.min(Math.max(chartPoints ?? days, 3), 400);

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ prices: makePrices(count) }),
    });
  });

  if (marketsStatus) {
    await context.route(`**${PROXY_PREFIX}/crypto/markets`, async (route) => {
      return route.fulfill({
        status: marketsStatus,
        contentType: "application/json",
        body: JSON.stringify({ error: "stub upstream error" }),
      });
    });
  }
}

export const TEST_USER_DOMAIN = TEST_EMAIL_DOMAIN;
