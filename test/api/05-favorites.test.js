import { describe, expect, it } from "vitest";
import { api, auth, createUser, favoritesOf } from "./support/helpers.mjs";
import { query } from "./support/db.mjs";

const addFavorite = (token, coinId) =>
  api().post("/favorites").set(auth(token)).send({ coinId });

describe("Избранное: базовые операции", () => {
  it("GET пустого избранного — 200 []", async () => {
    const { token } = await createUser();
    const response = await api().get("/favorites").set(auth(token));

    expect(response.status).toBe(200);
    expect(response.body.favorites).toEqual([]);
  });

  it("POST добавляет монету и она видна в GET", async () => {
    const { token } = await createUser();

    const added = await addFavorite(token, "bitcoin");
    expect(added.status).toBe(200);
    expect(added.body.favorites).toEqual(["bitcoin"]);

    const list = await api().get("/favorites").set(auth(token));
    expect(list.body.favorites).toEqual(["bitcoin"]);
  });

  it("повторное добавление идемпотентно", async () => {
    const { token, userId } = await createUser();

    await addFavorite(token, "bitcoin");
    const second = await addFavorite(token, "bitcoin");

    expect(second.status).toBe(200);
    expect(second.body.favorites).toEqual(["bitcoin"]);
    expect(await favoritesOf(userId)).toEqual(["bitcoin"]);
  });

  it("DELETE /favorites/:coinId удаляет одну монету", async () => {
    const { token, userId } = await createUser();
    await addFavorite(token, "bitcoin");
    await addFavorite(token, "ethereum");

    const removed = await api()
      .delete("/favorites/bitcoin")
      .set(auth(token));

    expect(removed.status).toBe(200);
    expect(removed.body.favorites).toEqual(["ethereum"]);
    expect(await favoritesOf(userId)).toEqual(["ethereum"]);
  });

  it("DELETE /favorites очищает всё избранное", async () => {
    const { token, userId } = await createUser();
    await addFavorite(token, "bitcoin");
    await addFavorite(token, "ethereum");

    const cleared = await api().delete("/favorites").set(auth(token));

    expect(cleared.status).toBe(200);
    expect(cleared.body.favorites).toEqual([]);
    expect(await favoritesOf(userId)).toEqual([]);
  });

  it("удаление несуществующей монеты не ломает запрос", async () => {
    const { token } = await createUser();

    const response = await api().delete("/favorites/litecoin").set(auth(token));
    expect(response.status).toBe(200);
    expect(response.body.favorites).toEqual([]);
  });
});

describe("Избранное: валидация идентификатора монеты", () => {
  const invalidIds = [
    "",
    "   ",
    "bitcoin bitcoin",
    "bitcoin/eth",
    "bitcoin$",
    "bitcoin'",
    "bitcoin;DROP TABLE cryptoinfavorites;--",
    "' OR 1=1--",
    "1;DELETE FROM users",
    "-bitcoin",
    "a".repeat(101),
  ];

  for (const coinId of invalidIds) {
    it(`400 в теле: ${JSON.stringify(coinId).slice(0, 40)}`, async () => {
      const { token } = await createUser();
      const response = await addFavorite(token, coinId);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Некорректный идентификатор монеты");
    });
  }

  it("400 без coinId в теле", async () => {
    const { token } = await createUser();
    const response = await api().post("/favorites").set(auth(token)).send({});

    expect(response.status).toBe(400);
  });

  it("400 в path-параметре: пробел и SQL-инъекция", async () => {
    const { token } = await createUser();
    const ids = ["bitcoin bitcoin", "' OR 1=1--", "a".repeat(101)];

    for (const coinId of ids) {
      const response = await api()
        .delete(`/favorites/${encodeURIComponent(coinId)}`)
        .set(auth(token));
      expect(response.status).toBe(400);
    }
  });

  it("после инъекций таблица избранного существует", async () => {
    const { token } = await createUser();
    await addFavorite(token, "bitcoin';DROP TABLE cryptoinfavorites;--");

    const table = await query("SELECT to_regclass('cryptoinfavorites') AS name");
    expect(table.rows[0].name).toBeTruthy();
  });
});


describe("Избранное: изоляция пользователей и подмена id", () => {
  it("чужое избранное не видно", async () => {
    const first = await createUser();
    const second = await createUser();

    await addFavorite(first.token, "bitcoin");
    await addFavorite(first.token, "ethereum");
    await addFavorite(second.token, "litecoin");

    const firstList = await api().get("/favorites").set(auth(first.token));
    const secondList = await api().get("/favorites").set(auth(second.token));

    expect(firstList.body.favorites.sort()).toEqual(["bitcoin", "ethereum"]);
    expect(secondList.body.favorites).toEqual(["litecoin"]);
  });

  it("удаление чужой монеты не затрагивает чужое избранное", async () => {
    const owner = await createUser();
    const attacker = await createUser();
    await addFavorite(owner.token, "bitcoin");

    const response = await api()
      .delete("/favorites/bitcoin")
      .set(auth(attacker.token));

    expect(response.status).toBe(200);
    expect(await favoritesOf(owner.userId)).toEqual(["bitcoin"]);
    expect(await favoritesOf(attacker.userId)).toEqual([]);
  });

  it("чужая очистка избранного не затрагивает чужое избранное", async () => {
    const owner = await createUser();
    const attacker = await createUser();
    await addFavorite(owner.token, "bitcoin");

    const response = await api().delete("/favorites").set(auth(attacker.token));

    expect(response.status).toBe(200);
    expect(await favoritesOf(owner.userId)).toEqual(["bitcoin"]);
  });

  it("id пользователя в теле игнорируется: запись привязана к владельцу токена", async () => {
    const owner = await createUser();
    const attacker = await createUser();

    const response = await api()
      .post("/favorites")
      .set(auth(attacker.token))
      .send({ coinId: "bitcoin", idusers: owner.userId, userId: owner.userId });

    expect(response.status).toBe(200);
    expect(await favoritesOf(owner.userId)).toEqual([]);
    expect(await favoritesOf(attacker.userId)).toEqual(["bitcoin"]);
  });

  it("верхний регистр идентификатора допускается и сохраняется как есть", async () => {
    const { token, userId } = await createUser();
    const response = await addFavorite(token, "Bitcoin");

    expect(response.status).toBe(200);
    expect(await favoritesOf(userId)).toEqual(["Bitcoin"]);
  });
});
