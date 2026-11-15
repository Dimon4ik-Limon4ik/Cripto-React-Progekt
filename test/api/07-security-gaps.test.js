import { describe, expect, it } from "vitest";
import { api, auth, createUser, loginUser } from "./support/helpers.mjs";

// ВНИМАНИЕ: тесты в этом файле описывают желаемое безопасное поведение.
// На текущем коде они ПАДАЮТ — это зафиксированные дефекты (см.
// test/reports/FIXES_FOR_AGENT.md). После исправления кода тесты должны
// проходить без изменения ожиданий.

describe("Дефект: нет ограничения частоты попыток входа", () => {
  it("после серии неверных паролей должен появиться 429", async () => {
    const { user } = await createUser();
    const statuses = [];

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await loginUser(user.login, `wrong-${attempt}`);
      statuses.push(response.status);
    }

    expect(statuses).toContain(429);
  });
});

describe("Дефект: слишком большое тело запроса", () => {
  it("тело больше лимита должно давать 413, а не 500", async () => {
    const bigBody = {
      login: "vtuser",
      password: "secret123",
      name: "x".repeat(200 * 1024),
    };

    const response = await api().post("/auth/addUsers").send(bigBody);

    expect(response.status).toBe(413);
    expect(response.text.toLowerCase().includes(" at ")).toBe(false);
  });
});

describe("Дефект: отсутствуют защитные HTTP-заголовки", () => {
  it("GET / должен отдавать базовые security-заголовки", async () => {
    const response = await api().get("/");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBeDefined();
    expect(response.headers["referrer-policy"]).toBeDefined();
    expect(response.headers["content-security-policy"]).toBeDefined();
  });
});

describe("Дефект: старый JWT живёт после смены пароля", () => {
  it("токен, выданный до смены пароля, должен становиться недействительным", async () => {
    const { token, user } = await createUser();

    const changed = await api().patch("/auth/changePassword").set(auth(token)).send({
      currentPassword: user.password,
      newPassword: "newsecret",
      confirmPassword: "newsecret",
    });
    expect(changed.status).toBe(200);

    const afterChange = await api().get("/auth/profile").set(auth(token));
    expect(afterChange.status).toBe(401);
  });
});

describe("Дефект: нет ограничения длины логина и пароля при входе", () => {
  it("слишком длинные login/password должны отклоняться с 400", async () => {
    const response = await api()
      .post("/auth/login")
      .send({ login: "l".repeat(5000), password: "p".repeat(5000) });

    expect(response.status).toBe(400);
  });
});
