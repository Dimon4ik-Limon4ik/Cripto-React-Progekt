// Общие помощники API-тестов: supertest-клиент, генерация тестовых
// пользователей, подпись JWT, автоматическая очистка созданных записей.
import crypto from "node:crypto";
import request from "supertest";
import jwt from "../../../backend/node_modules/jsonwebtoken/index.js";
import { BASE_URL, jwtSecret } from "./env.mjs";
import { query } from "./db.mjs";

// Маркер тестовых аккаунтов: по нему безопасно удалять только свои записи.
export const TEST_EMAIL_DOMAIN = "@vitest.local";
const createdUserIds = new Set();

export function api() {
  return request(BASE_URL);
}

export function uniqueLogin() {
  return `vt${Date.now().toString(36).slice(-6)}${crypto.randomBytes(2).toString("hex")}`;
}

export function makeUserData(overrides = {}) {
  const login = overrides.login ?? uniqueLogin();

  return {
    name: "Vitest User",
    login,
    email: `${login}${TEST_EMAIL_DOMAIN}`,
    password: "secret123",
    ...overrides,
  };
}

export function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

export function signToken(payload, options = {}) {
  // secret — отдельный аргумент jwt.sign, в options его передавать нельзя.
  const { secret, ...signOptions } = options;
  return jwt.sign(payload, secret ?? jwtSecret, { expiresIn: "1h", ...signOptions });
}

export function signWithWrongSecret(payload) {
  return signToken(payload, { secret: "definitely-not-the-project-secret" });
}

export function trackUser(userId) {
  if (Number.isInteger(userId)) {
    createdUserIds.add(userId);
  }
}

export function trackedUserIds() {
  return [...createdUserIds];
}

// Регистрирует пользователя через API и запоминает id для очистки.
export async function registerUser(overrides = {}) {
  const data = makeUserData(overrides);
  const response = await api().post("/auth/addUsers").send(data);

  if (response.status === 201) {
    trackUser(response.body.userId);
  }

  return { data, response };
}

// Регистрация «как надо»: если не 201 — тест должен упасть явно.
export async function createUser(overrides = {}) {
  const { data, response } = await registerUser(overrides);

  if (response.status !== 201) {
    throw new Error(
      `Не удалось создать тестового пользователя: статус ${response.status}`,
    );
  }

  return { user: data, token: response.body.token, userId: response.body.userId };
}

export async function loginUser(login, password) {
  return api().post("/auth/login").send({ login, password });
}

// Удаляем только созданные тестами записи (по id), чужие данные не трогаем.
export async function cleanupTrackedUsers() {
  const ids = [...createdUserIds];
  createdUserIds.clear();

  if (ids.length === 0) {
    return 0;
  }

  await query("DELETE FROM cryptoinfavorites WHERE idusers = ANY($1::int[])", [ids]);
  await query("DELETE FROM users WHERE idusers = ANY($1::int[])", [ids]);

  return ids.length;
}

// Экранирование динамического SQL в тестах не нужно: параметры передаются
// значениями, идентификаторы в тестах не подставляются.
export async function favoritesOf(userId) {
  const result = await query(
    "SELECT idcrypto FROM cryptoinfavorites WHERE idusers = $1 ORDER BY idcrypto",
    [userId],
  );
  return result.rows.map((row) => row.idcrypto);
}

export async function userExists(userId) {
  const result = await query("SELECT 1 FROM users WHERE idusers = $1", [userId]);
  return result.rowCount > 0;
}
