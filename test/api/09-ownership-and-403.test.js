import { describe, expect, it } from "vitest";
import {
  api,
  auth,
  createUser,
  favoritesOf,
  loginUser,
  signToken,
  signWithWrongSecret,
  userExists,
} from "./support/helpers.mjs";
import { query } from "./support/db.mjs";

// Файл описывает ТЕКУЩЕЕ (корректное) поведение и должен быть зелёным.
// Темы: код 403 (его в API нет), чужой/поддельный токен, подмена id,
// 404 на несуществующих ресурсах, SQL-инъекции в query-параметрах.

const addFavorite = (token, coinId) =>
  api().post("/favorites").set(auth(token)).send({ coinId });

const PROTECTED_ROUTES = [
  ["get", "/auth/profile"],
  ["get", "/auth/tokenCheck"],
  ["patch", "/auth/changePassword"],
  ["delete", "/auth/deleteAccount"],
  ["get", "/favorites"],
  ["post", "/favorites"],
  ["delete", "/favorites"],
  ["delete", "/favorites/bitcoin"],
];

describe("Код 403: ролевой модели в API нет, доступ проверяется токеном", () => {
  it("попытки доступа к чужому аккаунту не дают 403 и не меняют чужие данные", async () => {
    const victim = await createUser();
    const attacker = await createUser();
    await addFavorite(victim.token, "bitcoin");

    const attempts = [
      // Чужой id в query-параметрах.
      await api()
        .get(`/auth/profile?userId=${victim.userId}&idusers=${victim.userId}`)
        .set(auth(attacker.token)),
      await api().get(`/favorites?idusers=${victim.userId}`).set(auth(attacker.token)),
      // Чужой id в теле (попытка «стать» жертвой).
      await api()
        .patch("/auth/changePassword")
        .set(auth(attacker.token))
        .send({
          currentPassword: attacker.user.password,
          newPassword: "attackerpass",
          confirmPassword: "attackerpass",
          idusers: victim.userId,
          userId: victim.userId,
        }),
      // Удаление чужой монеты из чужих избранных.
      await api().delete("/favorites/bitcoin").set(auth(attacker.token)),
      // Удаление чужого аккаунта подменой id.
      await api()
        .delete("/auth/deleteAccount")
        .set(auth(attacker.token))
        .send({ password: "attackerpass", idusers: victim.userId }),
    ];

    for (const response of attempts) {
      // 403 возможен только при ролевой модели; в этом API её нет.
      expect(response.status).not.toBe(403);
    }

    // Жертва не пострадала.
    expect(await userExists(victim.userId)).toBe(true);
    expect(await favoritesOf(victim.userId)).toEqual(["bitcoin"]);
    expect((await loginUser(victim.user.login, victim.user.password)).status).toBe(200);
  });
});


describe("Доступ без токена, с чужим и подделанным токеном", () => {
  for (const [method, route] of PROTECTED_ROUTES) {
    it(`без токена: ${method.toUpperCase()} ${route} → 401, не 403`, async () => {
      const response = await api()[method](route).send({});

      expect(response.status).toBe(401);
      expect(response.status).not.toBe(403);
    });
  }

  it("токен, подписанный чужим секретом, отклоняется на всех защищённых маршрутах", async () => {
    const { userId } = await createUser();
    const forged = signWithWrongSecret({ userId });

    for (const [method, route] of PROTECTED_ROUTES) {
      const response = await api()[method](route).set(auth(forged)).send({});
      expect(response.status).toBe(401);
    }
  });

  it("чужой валидный токен даёт доступ только к данным своего владельца", async () => {
    const victim = await createUser();
    const attacker = await createUser();
    await addFavorite(victim.token, "bitcoin");
    await addFavorite(victim.token, "ethereum");

    const profile = await api()
      .get(`/auth/profile?userId=${victim.userId}&idusers=${victim.userId}`)
      .set(auth(attacker.token));
    const favorites = await api()
      .get(`/favorites?idusers=${victim.userId}`)
      .set(auth(attacker.token));

    expect(profile.status).toBe(200);
    expect(profile.body.user.id).toBe(attacker.userId);
    expect(profile.body.user.email).toBe(attacker.user.email);
    expect(profile.body.user.email).not.toBe(victim.user.email);

    expect(favorites.status).toBe(200);
    expect(favorites.body.favorites).toEqual([]);
  });

  it("подделанный payload токена не принимается", async () => {
    const { userId } = await createUser();
    const token = signToken({ userId });
    const [header, , signature] = token.split(".");
    const payload = Buffer.from(JSON.stringify({ userId: userId + 1 })).toString(
      "base64url",
    );

    const response = await api()
      .get("/auth/profile")
      .set(auth(`${header}.${payload}.${signature}`));

    expect(response.status).toBe(401);
  });
});

describe("404: несуществующие маршруты и лишние сегменты пути", () => {
  const cases = [
    ["get", "/crypto/nope", false],
    ["post", "/crypto/markets", false],
    ["get", "/auth/nope", false],
    ["get", "/auth/profile/extra", true],
    ["get", "/favorites/a/b", true],
    ["delete", "/favorites/bitcoin/extra", true],
    ["put", "/favorites", true],
  ];

  for (const [method, route, withToken] of cases) {
    it(`404: ${method.toUpperCase()} ${route}`, async () => {
      const request = api()[method](route);

      if (withToken) {
        const { token } = await createUser();
        request.set(auth(token));
      }

      const response = await request.send({});

      expect(response.status).toBe(404);
      expect(typeof response.body.error).toBe("string");
      expect(response.text.toLowerCase()).not.toContain(" at ");
    });
  }
});

describe("SQL-инъекции в query-параметрах", () => {
  it("инъекция в days не даёт 500 и не ломает таблицу users", async () => {
    const payloads = [
      "1;DROP TABLE users",
      "1' OR '1'='1",
      "1/**/UNION/**/SELECT/**/password/**/FROM/**/users",
      "-1;DELETE FROM cryptoinfavorites",
    ];

    for (const payload of payloads) {
      const response = await api().get(
        `/crypto/chart/stub-coin-0?days=${encodeURIComponent(payload)}`,
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.prices)).toBe(true);
    }

    const table = await query("SELECT to_regclass('users') AS name");
    expect(table.rows[0].name).toBeTruthy();
  });

  it("инъекция в idusers/userId профиля возвращает только свой профиль", async () => {
    const { token, userId } = await createUser();
    const payload = encodeURIComponent("1 OR 1=1;DROP TABLE users;--");

    const response = await api()
      .get(`/auth/profile?idusers=${payload}&userId=${payload}`)
      .set(auth(token));

    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe(userId);
  });

  it("инъекция в query избранного не подменяет владельца", async () => {
    const first = await createUser();
    const second = await createUser();
    await addFavorite(first.token, "bitcoin");

    const injection = encodeURIComponent("1' OR '1'='1");
    const response = await api()
      .get(`/favorites?idusers=${injection}&coinId=${encodeURIComponent("x' UNION SELECT 1--")}`)
      .set(auth(second.token));

    expect(response.status).toBe(200);
    expect(response.body.favorites).toEqual([]);
    expect(await favoritesOf(first.userId)).toEqual(["bitcoin"]);
    expect(await favoritesOf(second.userId)).toEqual([]);
  });

  it("массив в days не роняет сервер", async () => {
    const response = await api().get("/crypto/chart/stub-coin-0?days[]=7&days[]=8");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.prices)).toBe(true);
  });
});

