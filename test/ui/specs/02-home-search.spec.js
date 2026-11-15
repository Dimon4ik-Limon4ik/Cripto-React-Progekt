import { test, expect } from "../support/fixtures.mjs";
import { cardByName, gotoHome } from "../support/helpers.mjs";

test.describe("Главная страница", () => {
  test("карточки показывают имя, цену и изменение за 24 часа", async ({ page }) => {
    await gotoHome(page);

    const first = cardByName(page, "Stub Coin 0");
    await expect(first).toBeVisible();
    await expect(first.locator(".CardPrice")).toHaveText("100$");
    await expect(first.locator(".CardChange")).toContainText("%");
    await expect(first.locator(".star")).toHaveAttribute("aria-pressed", "false");
  });

  test("поиск фильтрует карточки по началу названия без учёта регистра", async ({
    page,
  }) => {
    await gotoHome(page);
    const search = page.locator(".CriptoSearch");

    await search.fill("stub coin 1");
    // Подходят "Stub Coin 1", "Stub Coin 10", "Stub Coin 11".
    await expect(page.locator(".pageConten .Card")).toHaveCount(3);

    await search.fill("STUB COIN 7");
    await expect(page.locator(".pageConten .Card")).toHaveCount(1);
    await expect(cardByName(page, "Stub Coin 7")).toBeVisible();

    await search.fill("такой монеты нет");
    await expect(page.locator(".pageConten .Card")).toHaveCount(0);

    await search.fill("");
    await expect(page.locator(".pageConten .Card")).toHaveCount(12);
  });

  test("бегущие строки показывают топ роста и топ падения", async ({ page }) => {
    await gotoHome(page);

    await expect(page.locator(".tickerContainer")).toContainText("Топ 10 рост за 24 часа");
    await expect(page.locator(".losersTickerContainer")).toContainText(
      "Топ 10 падение за 24 часа",
    );
  });

  test("клик по карточке открывает страницу монеты", async ({ page }) => {
    await gotoHome(page);

    await cardByName(page, "Stub Coin 3").click();

    await expect(page).toHaveURL(/\/coin\/stub-coin-3$/);
    await expect(page.locator(".coinName")).toHaveText("Stub Coin 3");
  });

  test("карточка открывается с клавиатуры (Enter)", async ({ page }) => {
    await gotoHome(page);

    await page.getByRole("button", { name: "Открыть страницу Stub Coin 2" }).focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/coin\/stub-coin-2$/);
  });

  // ВНИМАНИЕ: тест описывает желаемое поведение. На текущем коде он ПАДАЕТ:
  // при ошибке запроса котировок главная навсегда остаётся на «Загрузка...».
  test("дефект: при ошибке загрузки котировок нужен понятный статус и повтор", async ({
    page,
    context,
  }) => {
    await context.route("**/__e2e-api/crypto/markets", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "stub upstream error" }),
      }),
    );

    await page.goto("/Home");

    await expect(page.getByText("Загрузка...")).toBeVisible();
    await expect(page.getByText(/Не удалось загрузить|Ошибка загрузки|Повторить/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
