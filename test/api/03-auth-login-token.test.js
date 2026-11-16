import { describe, expect, it } from "vitest";
import {
  api,
  auth,
  createUser,
  loginUser,
  signToken,
  signWithWrongSecret,
} from "./support/helpers.mjs";

describe("POST /auth/login", () => {
  it("200: верный пароль даёт новый токен", async () => {
    const { user, userId } = await createUser();
    const response = await loginUser(user.login, user.password);

    expect(response.status).toBe(200);
    expect(response.body.userId).toBe(userId);
    expect(response.body.token.split(".").length).toBe(3);

    const check = await api()
      .get("/auth/tokenCheck")
      .set(auth(response.body.token));
    expect(check.status).toBe(200);
  });

  it("401: неверный пароль", async () => {
    const { user } = await createUser();
    const response = await loginUser(user.login, "wrong-password");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Неверный логин или пароль");
  });

  it("401: несуществующий логин, сообщение совпадает с неверным паролем", async () => {
    const { user } = await createUser();
    const unknown = await loginUser(`nouser_${Date.now()}`, "secret123");
    const wrong = await loginUser(user.login, "wrong-password");

    expect(unknown.status).toBe(401);
    expect(unknown.body.error).toBe(wrong.body.error);
  });

  it("400: пустые и нестроковые поля", async () => {
    const cases = [
      {},
      { login: "", password: "" },
      { login: "   ", password: "secret123" },
      { login: "vtuser", password: "" },
      { login: 123456, password: "secret123" },
      { login: "vtuser", password: 123456 },
    ];

    for (const body of cases) {
      const response = await api().post("/auth/login").send(body);
      expect(response.status).toBe(400);
    }
  });

  it("SQL-инъекция в login не даёт доступ", async () => {
    await createUser();

    const injections = [
      "' OR '1'='1",
      "admin'--",
      "' OR 1=1 LIMIT 1--",
      "'; DROP TABLE users;--",
    ];

    for (const login of injections) {
      const response = await api()
        .post("/auth/login")
        .send({ login, password: "x" });
      expect(response.status).toBe(401);
      expect(response.body.token).toBeUndefined();
    }

    const health = await api().get("/");
    expect(health.status).toBe(200);
  });
});

describe("TokenCheck — защищённые маршруты", () => {
  const protectedRoutes = [
    ["get", "/auth/profile"],
    ["get", "/auth/tokenCheck"],
    ["patch", "/auth/changePassword"],
    ["delete", "/auth/deleteAccount"],
    ["get", "/favorites"],
    ["post", "/favorites"],
    ["delete", "/favorites"],
    ["delete", "/favorites/bitcoin"],
  ];

  for (const [method, route] of protectedRoutes) {
    it(`401 без токена: ${method.toUpperCase()} ${route}`, async () => {
      const response = await api()[method](route).send({});

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Токен отсутствует");
    });
  }

  it("401 при некорректном заголовке Authorization", async () => {
    const headers = [
      "Basic abc",
      "Bearer",
      "Bearer ",
      "Token abc",
      "bearer abc",
    ];

    for (const value of headers) {
      const response = await api()
        .get("/auth/profile")
        .set("Authorization", value);
      expect(response.status).toBe(401);
    }
  });

  it("401 при мусорном токене", async () => {
    for (const token of ["abc", "a.b.c", "x".repeat(500)]) {
      const response = await api().get("/auth/profile").set(auth(token));
      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Токен недействителен");
    }
  });

  it("401 при токене, подписанном чужим секретом", async () => {
    const { userId } = await createUser();
    const response = await api()
      .get("/auth/profile")
      .set(auth(signWithWrongSecret({ userId })));

    expect(response.status).toBe(401);
  });

  it("401 при подделке полезной нагрузки без валидной подписи", async () => {
    const { userId } = await createUser();
    const [header, , signature] = signToken({ userId }).split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ userId: userId + 1000 }),
      "utf8",
    ).toString("base64url");

    const response = await api()
      .get("/auth/profile")
      .set(auth(`${header}.${forgedPayload}.${signature}`));

    expect(response.status).toBe(401);
  });

  it("401 при изменённой подписи", async () => {
    const { userId } = await createUser();
    const valid = signToken({ userId });
    const tampered = `${valid.slice(0, -1)}${valid.endsWith("a") ? "b" : "a"}`;

    const response = await api().get("/auth/profile").set(auth(tampered));
    expect(response.status).toBe(401);
  });

  it("401 для просроченного токена", async () => {
    const { userId } = await createUser();
    const expired = signToken({ userId }, { expiresIn: -10 });

    const response = await api().get("/auth/profile").set(auth(expired));
    expect(response.status).toBe(401);
  });

  it("401 для токена с alg=none", async () => {
    const { userId } = await createUser();
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ userId })).toString(
      "base64url",
    );

    const response = await api()
      .get("/auth/profile")
      .set(auth(`${header}.${payload}.`));
    expect(response.status).toBe(401);
  });

  it("401 для валидного токена с несуществующим userId", async () => {
    const response = await api()
      .get("/auth/profile")
      .set(auth(signToken({ userId: 2_000_000_000 })));

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Пользователь не найден");
  });

  it("401 для токена без userId", async () => {
    const response = await api()
      .get("/auth/profile")
      .set(auth(signToken({ login: "someone" })));

    expect(response.status).toBe(401);
    expect(response.body.error).toContain("Сессия устарела");
  });

  it("200 /auth/tokenCheck с валидным токеном", async () => {
    const { token, userId } = await createUser();
    const response = await api().get("/auth/tokenCheck").set(auth(token));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ valid: true, userId });
  });
});
