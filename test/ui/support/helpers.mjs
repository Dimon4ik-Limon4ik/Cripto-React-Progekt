// Хелперы UI-тестов: создание тестовых аккаунтов через API (быстрая
// подготовка данных) и типовые действия в интерфейсе.
import { expect, request } from "@playwright/test";
import { BACKEND_URL, TEST_EMAIL_DOMAIN } from "./env.mjs";

export const TOKEN_KEY = "token";

export function uniqueLogin() {
  // 10 символов: влезает в ограничение логина 6..15 при регистрации.
  const random = Math.random().toString(16).slice(2, 10).padEnd(8, "0");
  return `ui${Date.now().toString(36).slice(-4)}${random.slice(0, 4)}`.slice(0, 15);
}

export function makeUser(overrides = {}) {
  const login = overrides.login ?? uniqueLogin();

  return {
    name: "UI Test User",
    login,
    password: "secret123",
    email: `${login}${TEST_EMAIL_DOMAIN}`,
    ...overrides,
  };
}

async function withApi(callback) {
  const api = await request.newContext({ baseURL: BACKEND_URL });

  try {
    return await callback(api);
  } finally {
    await api.dispose();
  }
}

// Регистрация «как надо»: если статус не 201 — тест падает явно.
export async function createUserViaApi(overrides = {}, options = {}) {
  const data = makeUser(overrides);

  return withApi(async (api) => {
    const response = await api.post("/auth/addUsers", { data });
    const status = response.status();
    const body = await response.json().catch(() => ({}));

    if (status !== 201) {
      throw new Error(`Не удалось создать тестового пользователя: статус ${status}`);
    }

    if (!body.token || !Number.isInteger(body.userId)) {
      throw new Error("API не вернул token/userId при регистрации");
    }

    // options.emailAsIs — оставить email как передан (для проверки дублей).
    void options;

    return { user: data, token: body.token, userId: body.userId };
  });
}

export async function registerViaApi(body) {
  return withApi(async (api) => {
    const response = await api.post("/auth/addUsers", { data: body });
    return { status: response.status(), body: await response.json().catch(() => ({})) };
  });
}

export async function loginViaApi(login, password) {
  return withApi(async (api) => {
    const response = await api.post("/auth/login", { data: { login, password } });
    return { status: response.status(), body: await response.json().catch(() => ({})) };
  });
}

export async function getProfileViaApi(token) {
  return withApi(async (api) => {
    const response = await api.get("/auth/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { status: response.status(), body: await response.json().catch(() => ({})) };
  });
}

// Токен кладём в localStorage до загрузки приложения — так тесты
// проверяют восстановление сессии без прохода формы входа.
export async function useToken(context, token) {
  await context.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // приватный режим — не мешает тесту, просто нет токена
      }
    },
    [TOKEN_KEY, token],
  );
}

export async function readToken(page) {
  return page.evaluate((key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }, TOKEN_KEY);
}

// Карточка монеты на главной (точное совпадение имени, а не подстрока).
export function cardByName(page, name) {
  return page
    .locator(".pageConten .Card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
}

export async function gotoHome(page) {
  await page.goto("/Home");
  await expect(page.locator(".pageConten .Card").first()).toBeVisible();
}

export async function fillAuthForm(page, data) {
  if (data.name !== undefined) {
    await page.getByPlaceholder("Имя").fill(data.name);
  }
  await page.getByPlaceholder("Логин").fill(data.login);
  await page.getByPlaceholder("Пароль").fill(data.password);
  if (data.email !== undefined) {
    await page.getByPlaceholder("Email").fill(data.email);
  }
}

export async function submitRegistration(page) {
  await page.getByRole("button", { name: "создать" }).click();
}

export async function submitLogin(page) {
  await page.getByRole("button", { name: "войти" }).click();
}
