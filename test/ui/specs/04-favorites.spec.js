import { test, expect } from "../support/fixtures.mjs";
import {
  cardByName,
  createUserViaApi,
  gotoHome,
  useToken,
} from "../support/helpers.mjs";

// Избранное: звезда на главной, персональный список в портфеле,
// сохранение в БД и изоляция пользователей.

test.describe("Звезда без авторизации", () => {
  test("звезда не сохраняется и просит войти", async ({ page }) => {
    await gotoHome(page);

    const star = cardByName(page, "Stub Coin 1").locator(".star");
    await star.click();

    await expect(page.locator(".Notifications-info")).toContainText(
      "Войдите, чтобы сохранять избранные монеты.",
    );
    await expect(star).toHaveAttribute("aria-pressed", "false");
    await expect(page).toHaveURL(/\/Home$/);
  });
});

test.describe("Избранное авторизованного пользователя", () => {
  test("звезда сохраняется на сервере и видна после перезагрузки", async ({
    page,
    context,
  }) => {
    const { token } = await createUserViaApi();
    await useToken(context, token);
    await gotoHome(page);

    const star = cardByName(page, "Stub Coin 1").locator(".star");
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expect(cardByName(page, "Stub Coin 1").locator(".star")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("избранная монета попадает в портфель", async ({ page, context }) => {
    const { token } = await createUserViaApi();
    await useToken(context, token);
    await gotoHome(page);

    await cardByName(page, "Stub Coin 4").locator(".star").click();
    await expect(
      cardByName(page, "Stub Coin 4").locator(".star"),
    ).toHaveAttribute("aria-pressed", "true");

    await page.locator(".functionalPanel .btnNav").nth(1).click();

    await expect(page).toHaveURL(/\/portfolio$/);
    await expect(page.locator(".portfolioCounter")).toHaveText("1");
    await expect(page.locator(".portfolioCardName").first()).toHaveText("Stub Coin 4");
  });

  test("снятие звезды в портфеле очищает список", async ({ page, context }) => {
    const { token } = await createUserViaApi();
    await useToken(context, token);
    await gotoHome(page);

    await cardByName(page, "Stub Coin 5").locator(".star").click();
    await page.locator(".functionalPanel .btnNav").nth(1).click();
    await expect(page.locator(".portfolioCounter")).toHaveText("1");

    await page.locator(".portfolioCardStar").first().click();

    await expect(page.locator(".portfolioEmptyTitle")).toHaveText(
      "В портфеле пока пусто",
    );
    await expect(page.locator(".portfolioCounter")).toHaveText("0");
  });

  test("избранное второго пользователя не видно", async ({ page, context }) => {
    const first = await createUserViaApi();
    const second = await createUserViaApi();

    await useToken(context, first.token);
    await gotoHome(page);
    await cardByName(page, "Stub Coin 6").locator(".star").click();
    await expect(
      cardByName(page, "Stub Coin 6").locator(".star"),
    ).toHaveAttribute("aria-pressed", "true");

    // Переключаем сессию на второго пользователя.
    await page.evaluate((token) => window.localStorage.setItem("token", token), second.token);
    await page.goto("/portfolio");

    await expect(page.locator(".portfolioEmptyTitle")).toHaveText(
      "В портфеле пока пусто",
    );
    await expect(page.locator(".portfolioCounter")).toHaveText("0");
  });
});
