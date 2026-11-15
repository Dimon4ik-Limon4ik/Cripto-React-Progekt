import { describe, expect, it } from "vitest";
import {
  api,
  auth,
  createUser,
  favoritesOf,
  loginUser,
  userExists,
} from "./support/helpers.mjs";

describe("GET /auth/profile", () => {
  it("200: данные только своего профиля, без пароля и хеша", async () => {
    const { token, userId, user } = await createUser();
    const response = await api().get("/auth/profile").set(auth(token));

    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe(userId);
    expect(response.body.user.login).toBe(user.login);
    expect(response.body.user.email).toBe(user.email);
    expect(Number.isNaN(Date.parse(response.body.user.registeredAt))).toBe(false);

    const text = JSON.stringify(response.body).toLowerCase();
    expect(text.includes("password")).toBe(false);
    expect(text.includes("$2b$")).toBe(false);
  });

  it("401 без токена", async () => {
    const response = await api().get("/auth/profile");
    expect(response.status).toBe(401);
  });
});

describe("PATCH /auth/changePassword", () => {
  it("400: неполные данные и несовпадающие пароли", async () => {
    const { token } = await createUser();

    const cases = [
      {},
      { currentPassword: "secret123" },
      { currentPassword: "secret123", newPassword: "newsecret", confirmPassword: "" },
      { currentPassword: "secret123", newPassword: "12345", confirmPassword: "12345" },
      {
        currentPassword: "secret123",
        newPassword: "a".repeat(16),
        confirmPassword: "a".repeat(16),
      },
      {
        currentPassword: "secret123",
        newPassword: "newsecret",
        confirmPassword: "different",
      },
      { currentPassword: 1, newPassword: "newsecret", confirmPassword: "newsecret" },
    ];

    for (const body of cases) {
      const response = await api()
        .patch("/auth/changePassword")
        .set(auth(token))
        .send(body);
      expect(response.status).toBe(400);
    }
  });

  it("400: неверный текущий пароль", async () => {
    const { token } = await createUser();
    const response = await api().patch("/auth/changePassword").set(auth(token)).send({
      currentPassword: "wrong-password",
      newPassword: "newsecret",
      confirmPassword: "newsecret",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Неверный текущий пароль");
  });

  it("200: пароль меняется, старый перестаёт работать", async () => {
    const { user, token } = await createUser();

    const changed = await api()
      .patch("/auth/changePassword")
      .set(auth(token))
      .send({
        currentPassword: user.password,
        newPassword: "newsecret",
        confirmPassword: "newsecret",
      });

    expect(changed.status).toBe(200);

    expect((await loginUser(user.login, user.password)).status).toBe(401);
    expect((await loginUser(user.login, "newsecret")).status).toBe(200);
  });

  it("чужой id в теле игнорируется: меняется только свой пароль", async () => {
    const first = await createUser();
    const second = await createUser();

    const response = await api()
      .patch("/auth/changePassword")
      .set(auth(second.token))
      .send({
        currentPassword: second.user.password,
        newPassword: "secondpass",
        confirmPassword: "secondpass",
        idusers: first.userId,
        userId: first.userId,
      });

    expect(response.status).toBe(200);
    expect((await loginUser(first.user.login, first.user.password)).status).toBe(200);
    expect((await loginUser(second.user.login, "secondpass")).status).toBe(200);
  });
});

describe("DELETE /auth/deleteAccount", () => {
  it("400: пустой или нестроковый пароль", async () => {
    const { token } = await createUser();

    for (const body of [{}, { password: "" }, { password: 123456 }]) {
      const response = await api()
        .delete("/auth/deleteAccount")
        .set(auth(token))
        .send(body);
      expect(response.status).toBe(400);
    }
  });

  it("400: неверный пароль — аккаунт остаётся", async () => {
    const { token, userId } = await createUser();
    const response = await api()
      .delete("/auth/deleteAccount")
      .set(auth(token))
      .send({ password: "wrong-password" });

    expect(response.status).toBe(400);
    expect(await userExists(userId)).toBe(true);
  });

  it("200: аккаунт и его избранное удаляются, токен перестаёт работать", async () => {
    const { token, userId, user } = await createUser();

    const added = await api()
      .post("/favorites")
      .set(auth(token))
      .send({ coinId: "bitcoin" });
    expect(added.status).toBe(200);
    expect(await favoritesOf(userId)).toEqual(["bitcoin"]);

    const deleted = await api()
      .delete("/auth/deleteAccount")
      .set(auth(token))
      .send({ password: user.password });

    expect(deleted.status).toBe(200);
    expect(await userExists(userId)).toBe(false);
    expect(await favoritesOf(userId)).toEqual([]);

    const after = await api().get("/auth/profile").set(auth(token));
    expect(after.status).toBe(401);
  });

  it("401: повторное удаление с тем же токеном", async () => {
    const { token, user } = await createUser();

    const first = await api()
      .delete("/auth/deleteAccount")
      .set(auth(token))
      .send({ password: user.password });
    const second = await api()
      .delete("/auth/deleteAccount")
      .set(auth(token))
      .send({ password: user.password });

    expect(first.status).toBe(200);
    expect(second.status).toBe(401);
  });

  it("чужой аккаунт нельзя удалить подменой id в теле", async () => {
    const victim = await createUser();
    const attacker = await createUser();

    const response = await api()
      .delete("/auth/deleteAccount")
      .set(auth(attacker.token))
      .send({ password: attacker.user.password, idusers: victim.userId });

    expect(response.status).toBe(200);
    expect(await userExists(victim.userId)).toBe(true);
    expect(await userExists(attacker.userId)).toBe(false);
  });
});
