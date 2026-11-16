import { test, expect } from "../support/fixtures.mjs";
import { createUserViaApi, useToken } from "../support/helpers.mjs";

// Каркас приложения: редиректы, защита маршрутов, шапка и тема.
// Данные о монетах приходят из тестового бэкенда (12 заглушек stub-coin-*).

test.describe("Маршрутизация", () => {
  test("GET / без токена перенаправляет на /authorization", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/authorization$/);
    await expect(page.locator(".LoginPanel")).toBeVisible();
  });

  test("GET / с токеном перенаправляет на /Home и рисует карточки монет", async ({
    page,
    context,
  }) => {
    const { token } = await createUserViaApi();
    await useToken(context, token);

    await page.goto("/");

    await expect(page).toHaveURL(/\/Home$/);
    await expect(page.locator("h1").first()).toContainText("Найди любую криптовалюту");
    await expect(page.locator(".pageConten .Card")).toHaveCount(12);
  });

  test("/Home без токена перенаправляет на /authorization", async ({ page }) => {
    await page.goto("/Home");

    await expect(page).toHaveURL(/\/authorization$/);
    await expect(page.locator(".LoginPanel")).toBeVisible();
  });

  test("/coin/:coinId без токена перенаправляет на /authorization", async ({ page }) => {
    await page.goto("/coin/stub-coin-0");

    await expect(page).toHaveURL(/\/authorization$/);
    await expect(page.locator(".LoginPanel")).toBeVisible();
  });

  test("неизвестный маршрут без токена перенаправляет на /authorization", async ({ page }) => {
    await page.goto("/no-such-page");

    await expect(page).toHaveURL(/\/authorization$/);
    await expect(page.locator(".LoginPanel")).toBeVisible();
  });

  test("неизвестный маршрут с токеном перенаправляет на /Home", async ({
    page,
    context,
  }) => {
    const { token } = await createUserViaApi();
    await useToken(context, token);

    await page.goto("/no-such-page");

    await expect(page).toHaveURL(/\/Home$/);
    await expect(page.locator(".pageConten .Card").first()).toBeVisible();
  });

  test("/portfolio без токена перенаправляет на /authorization", async ({ page }) => {
    await page.goto("/portfolio");

    await expect(page).toHaveURL(/\/authorization$/);
    await expect(page.locator(".LoginPanel")).toBeVisible();
  });

  test("/profile без токена перенаправляет на /authorization", async ({ page }) => {
    await page.goto("/profile");

    await expect(page).toHaveURL(/\/authorization$/);
    await expect(page.locator(".LoginPanel")).toBeVisible();
  });

  test("/authorization при активной сессии перенаправляет на /Home", async ({
    page,
    context,
  }) => {
    const { token } = await createUserViaApi();
    await useToken(context, token);

    await page.goto("/authorization");

    await expect(page).toHaveURL(/\/Home$/);
  });
});

test.describe("Шапка и тема", () => {
  test("переключение темы меняет классы каркаса и сохраняется при навигации", async ({
    page,
    context,
  }) => {
    const { token } = await createUserViaApi();
    await useToken(context, token);
    await page.goto("/Home");

    const layout = page.locator(".backgroundLayout");
    await expect(layout).not.toHaveClass(/backgroundLayoutDark/);

    await page.locator(".btnSunMoon").click();
    await expect(layout).toHaveClass(/backgroundLayoutDark/);

    // Переход на портфель (SPA) не сбрасывает тему.
    await page.locator(".functionalPanel .btnNav").nth(1).click();
    await expect(page).toHaveURL(/\/portfolio$/);
    await expect(layout).toHaveClass(/backgroundLayoutDark/);

    await page.locator(".btnSunMoon").click();
    await expect(layout).not.toHaveClass(/backgroundLayoutDark/);
  });

  test("кнопки шапки ведут на главную, в портфель и профиль", async ({
    page,
    context,
  }) => {
    const { token } = await createUserViaApi();
    await useToken(context, token);
    await page.goto("/Home");

    const buttons = page.locator(".functionalPanel .btnNav");

    await buttons.nth(1).click();
    await expect(page).toHaveURL(/\/portfolio$/);

    await buttons.nth(2).click();
    await expect(page).toHaveURL(/\/profile$/);

    await buttons.nth(0).click();
    await expect(page).toHaveURL(/\/Home$/);
  });

  test("выход из аккаунта возвращает на /authorization и удаляет токен", async ({
    page,
    context,
  }) => {
    const { token } = await createUserViaApi();
    await useToken(context, token);
    await page.goto("/Home");
    await expect(page.locator(".pageConten .Card").first()).toBeVisible();

    await page.locator(".outBtn").click();

    await expect(page).toHaveURL(/\/authorization$/);
    await expect(page.locator(".LoginPanel")).toBeVisible();

    const stored = await page.evaluate(() => window.localStorage.getItem("token"));
    expect(stored).toBeNull();
  });
});
