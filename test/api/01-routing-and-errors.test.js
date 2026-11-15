import { describe, expect, it } from "vitest";
import { api } from "./support/helpers.mjs";

// В теле ответа не должно быть стека, SQL и путей к файлам.
const LEAK_MARKERS = [
  " at ",
  "node_modules",
  ".js:",
  "SELECT ",
  "INSERT ",
  "UPDATE ",
  "DELETE FROM",
  "ECONNREFUSED",
  "stack",
];

function assertNoLeaks(text) {
  const lower = String(text).toLowerCase();

  for (const marker of LEAK_MARKERS) {
    expect(lower.includes(marker.toLowerCase())).toBe(false);
  }

  expect(lower.includes("password")).toBe(false);
}

describe("Маршрутизация и обработка ошибок", () => {
  it("GET / отвечает 200 и {status:'ok'}", async () => {
    const response = await api().get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("неизвестный маршрут — 404 JSON без стека", async () => {
    const response = await api().get("/no-such-route");

    expect(response.status).toBe(404);
    expect(typeof response.body.error).toBe("string");
    assertNoLeaks(response.text);
  });

  it("неподдерживаемый метод на существующем пути — 404", async () => {
    const response = await api().put("/auth/login").send({ login: "a", password: "b" });

    expect(response.status).toBe(404);
  });

  it("битый JSON в теле — 400 и понятное сообщение", async () => {
    const response = await api()
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send('{"login": ');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Некорректный JSON в запросе");
    assertNoLeaks(response.text);
  });

  it("JSON-примитив в теле — 400", async () => {
    const response = await api()
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send('"just-a-string"');

    expect(response.status).toBe(400);
  });

  it("CORS: разрешённый Origin отражается в ответе", async () => {
    const response = await api()
      .get("/")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers.vary).toContain("Origin");
  });

  it("CORS: чужой Origin не получает разрешения", async () => {
    const response = await api()
      .get("/")
      .set("Origin", "https://evil.example");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("preflight OPTIONS возвращает 204", async () => {
    const response = await api()
      .options("/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(204);
  });

  it("в ответах на типовые ошибочные запросы нет стека и SQL", async () => {
    const responses = [
      await api().get("/nope"),
      await api().get("/auth/profile"),
      await api().post("/auth/addUsers").send({}),
      await api().post("/auth/login").send({ login: "", password: "" }),
      await api().get("/favorites"),
      await api()
        .post("/auth/login")
        .set("Content-Type", "application/json")
        .send("{broken"),
    ];

    for (const response of responses) {
      expect(response.status).toBeGreaterThanOrEqual(400);
      assertNoLeaks(response.text);
      expect(response.type).toContain("json");
    }
  });
});
