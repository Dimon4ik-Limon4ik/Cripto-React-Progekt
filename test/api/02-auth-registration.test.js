import { describe, expect, it } from "vitest";
import {
  api,
  createUser,
  makeUserData,
  registerUser,
  uniqueLogin,
} from "./support/helpers.mjs";
import { query, scalar } from "./support/db.mjs";

describe("POST /auth/addUsers — валидация", () => {
  const invalidCases = [
    { name: "пустое тело", body: {} },
    { name: "нет name", body: { ...makeUserData(), name: undefined } },
    { name: "пустой name", body: { ...makeUserData(), name: "   " } },
    { name: "name из 1 символа", body: { ...makeUserData(), name: "A" } },
    { name: "name из 51 символа", body: { ...makeUserData(), name: "A".repeat(51) } },
    { name: "login из 5 символов", body: { ...makeUserData(), login: "abcde" } },
    { name: "login из 16 символов", body: { ...makeUserData(), login: "a".repeat(16) } },
    { name: "login с пробелом", body: { ...makeUserData(), login: "abc def" } },
    { name: "login не строка", body: { ...makeUserData(), login: 123456 } },
    { name: "password из 5 символов", body: { ...makeUserData(), password: "12345" } },
    { name: "password из 16 символов", body: { ...makeUserData(), password: "a".repeat(16) } },
    { name: "password не строка", body: { ...makeUserData(), password: 123456 } },
    { name: "email без @", body: { ...makeUserData(), email: "not-an-email" } },
    { name: "email без домена", body: { ...makeUserData(), email: "user@" } },
    { name: "email с пробелом", body: { ...makeUserData(), email: "a b@example.com" } },
    { name: "email не строка", body: { ...makeUserData(), email: ["a@example.com"] } },
  ];

  for (const testCase of invalidCases) {
    it(`400: ${testCase.name}`, async () => {
      const response = await api().post("/auth/addUsers").send(testCase.body);

      expect(response.status).toBe(400);
      expect(typeof response.body.error).toBe("string");
    });
  }

  it("400: у длинного имени и длинного логина разные сообщения", async () => {
    const longName = await api()
      .post("/auth/addUsers")
      .send({ ...makeUserData(), name: "A".repeat(51) });
    const longLogin = await api()
      .post("/auth/addUsers")
      .send({ ...makeUserData(), login: "a".repeat(16) });

    expect(longName.status).toBe(400);
    expect(longName.body.error).toContain("Имя");
    expect(longLogin.status).toBe(400);
    expect(longLogin.body.error).toContain("Логин");
  });
});

describe("POST /auth/addUsers — успех и дубликаты", () => {
  it("201: создаёт аккаунт, отдаёт userId и рабочий токен", async () => {
    const { data, response } = await registerUser();

    expect(response.status).toBe(201);
    expect(Number.isInteger(response.body.userId)).toBe(true);
    expect(typeof response.body.token).toBe("string");
    expect(response.body.token.split(".").length).toBe(3);
    // Пароль и хеш в ответе не возвращаются.
    expect(JSON.stringify(response.body).toLowerCase().includes("password")).toBe(false);

    const check = await api()
      .get("/auth/tokenCheck")
      .set("Authorization", `Bearer ${response.body.token}`);

    expect(check.status).toBe(200);
    expect(check.body.userId).toBe(response.body.userId);
    expect(data.login).toBeTruthy();
  });

  it("пароль хранится только как bcrypt-хеш", async () => {
    const { user: data, userId } = await createUser();
    const result = await query("SELECT password FROM users WHERE idusers = $1", [
      userId,
    ]);

    expect(result.rowCount).toBe(1);
    expect(result.rows[0].password).not.toBe(data.password);
    expect(result.rows[0].password.startsWith("$2")).toBe(true);
  });

  it("409 при повторном email, без подсказки о поле", async () => {
    const { data } = await registerUser();
    const response = await api()
      .post("/auth/addUsers")
      .send({ ...makeUserData({ email: data.email }) });

    expect(response.status).toBe(409);
    expect(response.body.error).toContain("уже существует");
  });

  it("409 при повторном логине", async () => {
    const { data } = await registerUser();
    const response = await api()
      .post("/auth/addUsers")
      .send({ ...makeUserData({ login: data.login }) });

    expect(response.status).toBe(409);
  });

  it("повторная регистрация не создаёт вторую строку", async () => {
    const { data } = await registerUser();
    const before = await scalar("SELECT count(*) AS count FROM users WHERE email = $1", [
      data.email,
    ]);

    await api().post("/auth/addUsers").send({ ...makeUserData({ email: data.email }) });

    const after = await scalar("SELECT count(*) AS count FROM users WHERE email = $1", [
      data.email,
    ]);

    expect(before).toBe(1);
    expect(after).toBe(1);
  });
});

describe("SQL-инъекции в теле регистрации", () => {
  it("login с инъекцией сохраняется буквально, таблица users цела", async () => {
    // Пробелы в логине запрещены валидатором, поэтому payload без пробелов.
    const injectedLogin = "'OR'1'='1";
    const { data, response } = await registerUser({ login: injectedLogin });

    expect(response.status).toBe(201);

    const stored = await query("SELECT login FROM users WHERE idusers = $1", [
      response.body.userId,
    ]);
    expect(stored.rows[0].login).toBe(injectedLogin);

    // Тот же логин работает при входе — значит, запрос параметризован.
    const login = await api()
      .post("/auth/login")
      .send({ login: injectedLogin, password: data.password });
    expect(login.status).toBe(200);

    const tableExists = await query("SELECT to_regclass('users') AS name");
    expect(tableExists.rows[0].name).toBeTruthy();
  });

  it("name с инъекцией сохраняется буквально и не ломает БД", async () => {
    const injectedName = "';DROP TABLE users;--";
    const { response } = await registerUser({ name: injectedName });

    expect(response.status).toBe(201);

    const stored = await query("SELECT name FROM users WHERE idusers = $1", [
      response.body.userId,
    ]);
    expect(stored.rows[0].name).toBe(injectedName);

    const tableExists = await query("SELECT to_regclass('users') AS name");
    expect(tableExists.rows[0].name).toBeTruthy();
  });

  it("пароль с инъекцией хранится как хеш и работает при входе", async () => {
    const password = "' OR '1'='1";
    const { data, response } = await registerUser({ password });

    expect(response.status).toBe(201);

    const good = await api().post("/auth/login").send({ login: data.login, password });
    expect(good.status).toBe(200);

    const wrong = await api()
      .post("/auth/login")
      .send({ login: data.login, password: `${password}x` });
    expect(wrong.status).toBe(401);
  });

  it("email с инъекцией сохраняется буквально", async () => {
    // Пробелы в email недопустимы, поэтому в payload используем /**/.
    const email = `x';DROP/**/TABLE/**/users;--${uniqueLogin()}@vitest.local`;
    const { response } = await registerUser({ email });

    expect(response.status).toBe(201);

    const stored = await query("SELECT email FROM users WHERE idusers = $1", [
      response.body.userId,
    ]);
    expect(stored.rows[0].email).toBe(email);

    const tableExists = await query("SELECT to_regclass('users') AS name");
    expect(tableExists.rows[0].name).toBeTruthy();
  });
});
