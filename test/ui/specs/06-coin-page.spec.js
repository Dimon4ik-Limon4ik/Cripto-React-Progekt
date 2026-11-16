import { test, expect } from "../support/fixtures.mjs";
import { createUserViaApi, useToken } from "../support/helpers.mjs";

// Страница монеты: прямая загрузка, переключение периодов, 6 лет через Binance,
// неизвестная монета и кнопка «Назад».
// Данные графика подменяются детерминированно (не менее 3 точек).

const chart = (page) => page.getByRole("img", { name: "График изменения цены" });

test.describe("Страница монеты", () => {
  // Страница монеты доступна только с токеном: готовим сессию заранее.
  let session;

  test.beforeAll(async () => {
    session = await createUserViaApi();
  });

  test.beforeEach(async ({ context }) => {
    await useToken(context, session.token);
  });

  test("прямая загрузка по ссылке показывает монету и график", async ({ page }) => {
    await page.goto("/coin/stub-coin-0");

    await expect(page.locator(".coinName")).toHaveText("Stub Coin 0");
    await expect(page.locator(".coinSymbol")).toHaveText("S0");
    await expect(page.locator(".coinPrice")).toContainText("$");
    await expect(page.locator(".coinChangePeriod")).toHaveText("за 24 часа");
    await expect(chart(page)).toBeVisible();
    await expect(page.locator(".coinDataSource")).toHaveText("Данные: CoinGecko");
  });

  test("переключение периодов меняет подпись и перерисовывает график", async ({
    page,
  }) => {
    await page.goto("/coin/stub-coin-1");
    await expect(chart(page)).toBeVisible();

    const ranges = [
      ["7 дней", "за 7 дней"],
      ["30 дней", "за 30 дней"],
      ["1 год", "за 1 год"],
      ["24 часа", "за 24 часа"],
    ];

    for (const [label, period] of ranges) {
      const button = page.getByRole("button", { name: label, exact: true });
      await button.click();

      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".coinChangePeriod")).toHaveText(period);
      await expect(chart(page)).toBeVisible();
    }
  });

  test("период 6 лет берёт историю из Binance и рисует график", async ({ page }) => {
    await page.goto("/coin/stub-coin-2");
    await expect(chart(page)).toBeVisible();

    await page.getByRole("button", { name: "6 лет", exact: true }).click();

    await expect(page.locator(".coinDataSource")).toHaveText("Данные: CoinGecko · Binance");
    await expect(page.locator(".coinChangePeriod")).toHaveText("за 6 лет");
    await expect(chart(page)).toBeVisible();
  });

  test("неизвестная монета показывает понятную ошибку", async ({ page }) => {
    await page.goto("/coin/stub-unknown");

    await expect(page.locator(".coinStateTitle")).toHaveText("Не удалось загрузить монету");
  });

  test("кнопка «Назад» возвращает на главную", async ({ page }) => {
    await page.goto("/coin/stub-coin-3");
    await expect(page.locator(".coinName")).toHaveText("Stub Coin 3");

    await page.locator(".backNavBtn").click();

    await expect(page).toHaveURL(/\/Home$/);
    await expect(page.locator(".pageConten .Card").first()).toBeVisible();
  });
});
