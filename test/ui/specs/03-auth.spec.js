import { test, expect } from "../support/fixtures.mjs";
import {
  createUserViaApi,
  fillAuthForm,
  makeUser,
  readToken,
  submitLogin,
  submitRegistration,
  useToken,
} from "../support/helpers.mjs";

// Авторизация: клиентская валидация, регистрация, вход, восстановление сессии.
// Все аккаунты — синтетические (@vitest.local) и удаляются после прогона.

test.describe("Регистрация: клиентская валидация", () => {
  test("пустая форма не отправляется", async ({ page }) => {
    await page.goto("/authorization");
    await submitRegistration(page);

    await expect(page.locator(".Notifications-error")).toContainText("Заполните все поля");
    await expect(page).toHaveURL(/\/authorization$/);
  });

  test("короткий логин отклоняется", async ({ page }) => {
    await page.goto("/authorization");
    await fillAuthForm(page, { ...makeUser(), login: "abc" });
    await submitRegistration(page);

    await expect(page.locator(".Notifications-error")).toContainText(
      "Логин должен содержать от 6 до 15 символов",
    );
  });

  test("логин с пробелом отклоняется", async ({ page }) => {
    await page.goto("/authorization");
    await fillAuthForm(page, { ...makeUser(), login: "abc def" });
    await submitRegistration(page);

    await expect(page.locator(".Notifications-error")).toContainText(
      "Логин не должен содержать пробелы",
    );
  });

  test("некорректный email отклоняется", async ({ page }) => {
    await page.goto("/authorization");
    await fillAuthForm(page, { ...makeUser(), email: "not-an-email" });
    await submitRegistration(page);

    await expect(page.locator(".Notifications-error")).toContainText(
      "Введите корректный email",
    );
  });

  test("короткий пароль отклоняется", async ({ page }) => {
    await page.goto("/authorization");
    await fillAuthForm(page, { ...makeUser(), password: "123" });
    await submitRegistration(page);

    await expect(page.locator(".Notifications-error")).toContainText(
      "Пароль должен содержать от 6 до 15 символов",
    );
  });
});

test.describe("Регистрация: успех и дубликаты", () => {
  test("успешная регистрация ведёт на /Home и сохраняет токен", async ({ page }) => {
    await page.goto("/authorization");
    await fillAuthForm(page, makeUser());
    await submitRegistration(page);

    await expect(page).toHaveURL(/\/Home$/);
    await expect(page.locator(".Notifications-success")).toContainText(
      "Аккаунт создан. Добро пожаловать!",
    );

    const token = await readToken(page);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  test("повторный email показывает сообщение сервера", async ({ page }) => {
    const { user } = await createUserViaApi();

    await page.goto("/authorization");
    await fillAuthForm(page, makeUser({ email: user.email }));
    await submitRegistration(page);

    await expect(page.locator(".Notifications-error")).toContainText(
      "Пользователь с таким логином или email уже существует",
    );
    await expect(page).toHaveURL(/\/authorization$/);
  });
});

test.describe("Вход", () => {
  test("неверный пароль не пускает в приложение", async ({ page }) => {
    const { user } = await createUserViaApi();

    await page.goto("/authorization");
    await page.getByRole("button", { name: "Вход" }).click();
    await fillAuthForm(page, { login: user.login, password: "wrong-password" });
    await submitLogin(page);

    await expect(page.locator(".Notifications-error")).toContainText(
      "Неверный логин или пароль",
    );
    await expect(page).toHaveURL(/\/authorization$/);
    expect(await readToken(page)).toBeNull();
  });

  test("верный пароль открывает главную", async ({ page }) => {
    const { user } = await createUserViaApi();

    await page.goto("/authorization");
    await page.getByRole("button", { name: "Вход" }).click();
    await fillAuthForm(page, { login: user.login, password: user.password });
    await submitLogin(page);

    await expect(page).toHaveURL(/\/Home$/);
    await expect(page.locator(".Notifications-success")).toContainText(
      "Вы вошли в систему.",
    );
    await expect(page.locator(".pageConten .Card").first()).toBeVisible();
  });

  test("сессия восстанавливается после перезагрузки страницы", async ({
    page,
    context,
  }) => {
    const { token } = await createUserViaApi();
    await useToken(context, token);

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Профиль" })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("heading", { name: "Профиль" })).toBeVisible();
  });
});
