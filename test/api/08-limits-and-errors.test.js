import { describe, expect, it } from "vitest";
import { api, auth, createUser, makeUserData, registerUser, uniqueLogin } from "./support/helpers.mjs";

// ВНИМАНИЕ: как и 07-security-gaps.test.js, этот файл описывает ЖЕЛАЕМОЕ
// безопасное поведение. На текущем коде соответствующие тесты ПАДАЮТ —
// это зафиксированные дефекты (см. test/reports/FIXES_FOR_AGENT.md).
// После исправления кода тесты должны стать зелёными без правки ожиданий.

// Внутренности сервера/БД не должны попадать в тело ответа об ошибке.
const LEAK_MARKERS = [
  " at ",
  "node_modules",
  ".js:",
  "INSERT INTO",
  "SELECT ",
  "UPDATE ",
  "DELETE FROM",
  "varying(",
  "22001",
  "too long for type",
  "duplicate key",
  "constraint",
];

function assertNoInternals(text) {
  const lower = String(text).toLowerCase();

  for (const marker of LEAK_MARKERS) {
    expect(lower.includes(marker.toLowerCase())).toBe(false);
  }
}

describe("Дефект: нет ограничения длины email при регистрации", () => {
  // Фактическая схема копии: users.email VARCHAR(100) (см. test/tmp/03-schema.json).
  for (const length of [101, 255, 300]) {
    it(`email длиной ${length} должен отклоняться с 400, а не падать в 500`, async () => {
      const login = uniqueLogin();
      const suffix = "@vitest.local";
      const email = `${"e".repeat(length - suffix.length)}${suffix}`;

      const response = await api()
        .post("/auth/addUsers")
        .send({ name: "Vitest User", login, email, password: "secret123" });

      expect(response.status).toBe(400);
      assertNoInternals(response.text);
      expect(typeof response.body.error).toBe("string");
    });
  }
});

describe("Дефект: email сравнивается с учётом регистра", () => {
  it("повторная регистрация с тем же email в другом регистре должна давать 409", async () => {
    const login = uniqueLogin();
    const upperEmail = `${login.toUpperCase()}@vitest.local`;
    const lowerEmail = `${login}@vitest.local`;

    const first = await registerUser({ login, email: upperEmail });
    expect(first.response.status).toBe(201);

    const second = await registerUser({ email: lowerEmail });

    expect(second.response.status).toBe(409);
  });
});

describe("Дефект: заголовок X-Powered-By раскрывает стек", () => {
  it("ответы не должны содержать X-Powered-By", async () => {
    const response = await api().get("/");

    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("Дефект: в /crypto/* нет ограничения длины coinId", () => {
  it("coinId длиннее 100 символов должен отклоняться с 400", async () => {
    const longId = "a".repeat(200);

    const coin = await api().get(`/crypto/coin/${longId}`);
    const chart = await api().get(`/crypto/chart/${longId}`);

    expect(coin.status).toBe(400);
    expect(chart.status).toBe(400);
  });
});

describe("Дефект: 5xx внешнего API отдаётся клиенту как 5xx нашего сервера", () => {
  it("ошибка CoinGecko 500 должна транслироваться в 502", async () => {
    const coin = await api().get("/crypto/coin/stub-500");
    const chart = await api().get("/crypto/chart/stub-500");

    expect(coin.status).toBe(502);
    expect(chart.status).toBe(502);
    expect(coin.body.error).not.toContain("Внутренняя ошибка");
    assertNoInternals(coin.text);
    assertNoInternals(chart.text);
  });
});

describe("Дефект: новый пароль может совпадать с текущим", () => {
  it("смена пароля на тот же самый должна отклоняться с 400", async () => {
    const { token, user } = await createUser();

    const response = await api()
      .patch("/auth/changePassword")
      .set(auth(token))
      .send({
        currentPassword: user.password,
        newPassword: user.password,
        confirmPassword: user.password,
      });

    expect(response.status).toBe(400);
  });
});

describe("Контроль качества новых проверок", () => {
  it("email ровно 100 символов принимается (граница колонки users.email)", async () => {
    // Если этот тест падает — значит, дело не в длине email, а в чём-то ещё,
    // и дефект выше описан неверно.
    const login = uniqueLogin();
    const localPart = "e".repeat(100 - "@vitest.local".length);
    const { response } = await registerUser({
      login,
      email: `${localPart}@vitest.local`,
    });

    expect(response.status).toBe(201);
  });

  it("makeUserData не ломается при переопределении email", () => {
    const data = makeUserData({ email: "override@vitest.local" });

    expect(data.email).toBe("override@vitest.local");
    expect(typeof data.login).toBe("string");
  });
});
