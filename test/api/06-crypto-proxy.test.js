import { describe, expect, it } from "vitest";
import { api } from "./support/helpers.mjs";
import { coinGeckoKey } from "./support/env.mjs";

// Внешний CoinGecko в тестах заменён заглушкой (support/fetch-stub.mjs):
// сетевых запросов нет, ответы детерминированы.
const LEAK_MARKERS = [" at ", "node_modules", ".js:", "SELECT ", "ECONNREFUSED", "x_cg_demo_api_key"];

function assertClean(text) {
  const lower = String(text).toLowerCase();
  for (const marker of LEAK_MARKERS) {
    expect(lower.includes(marker.toLowerCase())).toBe(false);
  }
}

describe("GET /crypto/markets и топы", () => {
  it("200: список монет", async () => {
    const response = await api().get("/crypto/markets");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(12);
    expect(response.body[0].id).toBe("stub-coin-0");
  });

  it("200: top-gainers — 10 монет по убыванию изменения", async () => {
    const response = await api().get("/crypto/top-gainers");

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(10);

    const changes = response.body.map((coin) => coin.price_change_percentage_24h);
    expect([...changes].sort((a, b) => b - a)).toEqual(changes);
  });

  it("200: top-losers — 10 монет по возрастанию изменения", async () => {
    const response = await api().get("/crypto/top-losers");

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(10);

    const changes = response.body.map((coin) => coin.price_change_percentage_24h);
    expect([...changes].sort((a, b) => a - b)).toEqual(changes);
  });
});

describe("GET /crypto/coin/:coinId", () => {
  it("200: известная монета", async () => {
    const response = await api().get("/crypto/coin/stub-coin-3");

    expect(response.status).toBe(200);
    expect(response.body.id).toBe("stub-coin-3");
  });

  it("200 null для неизвестной монеты", async () => {
    const response = await api().get("/crypto/coin/stub-unknown");

    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
  });

  it("429 при ограничении внешнего API", async () => {
    const response = await api().get("/crypto/coin/stub-429");

    expect(response.status).toBe(429);
    expect(response.body.error).toContain("429");
    assertClean(response.text);
  });

  it("502 при некорректном ответе внешнего API", async () => {
    const response = await api().get("/crypto/coin/stub-bad-format");

    expect(response.status).toBe(502);
    expect(response.body.error).toContain("Некорректный формат");
    assertClean(response.text);
  });

  it("502 при сетевой ошибке внешнего API", async () => {
    const response = await api().get("/crypto/coin/stub-network");

    expect(response.status).toBe(502);
    expect(response.body.error).toContain("Не удалось получить данные");
    assertClean(response.text);
  });
});

describe("GET /crypto/chart/:coinId", () => {
  it("200: точки цены за 1 день по умолчанию", async () => {
    const response = await api().get("/crypto/chart/stub-coin-0");

    expect(response.status).toBe(200);
    expect(response.body.prices.length).toBe(1);
  });

  it("200: days=7 даёт 7 точек", async () => {
    const response = await api().get("/crypto/chart/stub-coin-0?days=7");

    expect(response.status).toBe(200);
    expect(response.body.prices.length).toBe(7);
  });

  it("200: days ограничивается 1..365", async () => {
    const zero = await api().get("/crypto/chart/stub-coin-0?days=0");
    const huge = await api().get("/crypto/chart/stub-coin-0?days=999");
    const broken = await api().get("/crypto/chart/stub-coin-0?days=abc");

    expect(zero.body.prices.length).toBe(1);
    expect(huge.body.prices.length).toBe(365);
    expect(broken.body.prices.length).toBe(1);
  });

  it("429 и 502 для сбоев внешнего API", async () => {
    const limited = await api().get("/crypto/chart/stub-429");
    const badFormat = await api().get("/crypto/chart/stub-bad-format");
    const network = await api().get("/crypto/chart/stub-network");

    expect(limited.status).toBe(429);
    expect(badFormat.status).toBe(502);
    expect(network.status).toBe(502);
    assertClean(limited.text);
    assertClean(badFormat.text);
    assertClean(network.text);
  });
});

describe("Прокси CoinGecko: инъекции и утечки", () => {
  it("SQL-инъекция в coinId не даёт 500 и не ломает ответ", async () => {
    const payloads = ["' OR 1=1--", "1;DROP TABLE users", "0' UNION SELECT password FROM users--"];

    for (const payload of payloads) {
      const coin = await api().get(`/crypto/coin/${encodeURIComponent(payload)}`);
      expect(coin.status).toBe(200);
      expect(coin.body).toBeNull();

      const chart = await api().get(`/crypto/chart/${encodeURIComponent(payload)}`);
      expect(chart.status).toBe(200);
      expect(Array.isArray(chart.body.prices)).toBe(true);
    }
  });

  it("API-ключ CoinGecko не попадает в ответы", async () => {
    const responses = [
      await api().get("/crypto/markets"),
      await api().get("/crypto/top-gainers"),
      await api().get("/crypto/coin/stub-coin-1"),
      await api().get("/crypto/coin/stub-429"),
      await api().get("/crypto/chart/stub-coin-1?days=2"),
    ];

    for (const response of responses) {
      expect(response.text.includes("x_cg_demo_api_key")).toBe(false);
      if (coinGeckoKey) {
        expect(response.text.includes(coinGeckoKey)).toBe(false);
      }
    }
  });
});
