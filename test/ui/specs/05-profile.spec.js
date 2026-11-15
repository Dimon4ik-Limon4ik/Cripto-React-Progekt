import { test, expect } from "../support/fixtures.mjs";
import {
  createUserViaApi,
  getProfileViaApi,
  loginViaApi,
  useToken,
} from "../support/helpers.mjs";

// Профиль: просмотр данных, смена пароля, удаление аккаунта.

async function openProfile(page) {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Профиль" })).toBeVisible();
  await expect(page.locator(".profileInfoGrid .profileInfoCard").first()).toBeVisible();
}

test.describe("Данные профиля", () => {
  test("показывает имя, логин, email и дату без пароля", async ({ page, context }) => {
    const { user, token } = await createUserViaApi();
    await useToken(context, token);
    await openProfile(page);

    // Берём только блок «Данные аккаунта»: ниже есть ещё строка «Пароль».
    const labels = page.locator(".profileInfoGrid .profileInfoLabel");
    await expect(labels).toHaveText(["Имя", "Логин", "Email", "Дата регистрации"]);

    const values = page.locator(".profileInfoGrid .profileInfoValue");
    await expect(values.nth(0)).toHaveText(user.name);
    await expect(values.nth(1)).toHaveText(user.login);
    await expect(values.nth(2)).toHaveText(user.email);
    await expect(values.nth(3)).not.toHaveText("—");

    // Хеш пароля в интерфейс не попадает, поле пароля маскируется.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("$2b$");
    await expect(page.locator(".profileSecurityValue")).toHaveText("••••••••");
  });
});

test.describe("Смена пароля", () => {
  test("пустые поля и несовпадение не отправляются на сервер", async ({
    page,
    context,
  }) => {
    const { token } = await createUserViaApi();
    await useToken(context, token);
    await openProfile(page);

    await page.getByRole("button", { name: "Сменить пароль" }).click();
    const dialog = page.getByRole("dialog", { name: "Смена пароля" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.locator(".Notifications-error")).toContainText("Заполните все поля");

    await dialog.getByLabel("Текущий пароль").fill("secret123");
    await dialog.getByLabel("Новый пароль", { exact: true }).fill("newsecret");
    await dialog.getByLabel("Повторите новый пароль").fill("different");
    await dialog.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.locator(".Notifications-error").last()).toContainText(
      "Новые пароли не совпадают",
    );
    await expect(dialog).toBeVisible();
  });

  test("неверный текущий пароль отклоняется сервером", async ({ page, context }) => {
    const { token } = await createUserViaApi();
    await useToken(context, token);
    await openProfile(page);

    await page.getByRole("button", { name: "Сменить пароль" }).click();
    const dialog = page.getByRole("dialog", { name: "Смена пароля" });

    await dialog.getByLabel("Текущий пароль").fill("wrong-password");
    await dialog.getByLabel("Новый пароль", { exact: true }).fill("newsecret");
    await dialog.getByLabel("Повторите новый пароль").fill("newsecret");
    await dialog.getByRole("button", { name: "Сохранить" }).click();

    await expect(page.locator(".Notifications-error")).toContainText(
      "Неверный текущий пароль",
    );
  });

  test("после успешной смены работает только новый пароль", async ({
    page,
    context,
  }) => {
    const { user, token } = await createUserViaApi();
    await useToken(context, token);
    await openProfile(page);

    await page.getByRole("button", { name: "Сменить пароль" }).click();
    const dialog = page.getByRole("dialog", { name: "Смена пароля" });

    await dialog.getByLabel("Текущий пароль").fill(user.password);
    await dialog.getByLabel("Новый пароль", { exact: true }).fill("newsecret");
    await dialog.getByLabel("Повторите новый пароль").fill("newsecret");
    await dialog.getByRole("button", { name: "Сохранить" }).click();

    await expect(page.locator(".Notifications-success")).toContainText(
      "Пароль успешно изменён.",
    );
    await expect(dialog).toBeHidden();

    expect((await loginViaApi(user.login, user.password)).status).toBe(401);
    expect((await loginViaApi(user.login, "newsecret")).status).toBe(200);
  });
});

test.describe("Удаление аккаунта", () => {
  test("без подтверждения и с неверным паролем аккаунт не удаляется", async ({
    page,
    context,
  }) => {
    const { token } = await createUserViaApi();
    await useToken(context, token);
    await openProfile(page);

    await page.getByRole("button", { name: "Удалить аккаунт" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Удаление аккаунта" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Текущий пароль").fill("secret123");
    await dialog.getByRole("button", { name: "Удалить аккаунт" }).click();
    await expect(page.locator(".Notifications-error")).toContainText(
      "Подтвердите удаление аккаунта",
    );

    await dialog.locator('input[type="checkbox"]').check();
    await dialog.getByLabel("Текущий пароль").fill("wrong-password");
    await dialog.getByRole("button", { name: "Удалить аккаунт" }).click();
    await expect(page.locator(".Notifications-error").last()).toContainText(
      "Неверный текущий пароль",
    );

    expect((await getProfileViaApi(token)).status).toBe(200);
  });

  test("подтверждённое удаление завершает сессию", async ({ page, context }) => {
    const { user, token } = await createUserViaApi();
    await useToken(context, token);
    await openProfile(page);

    await page.getByRole("button", { name: "Удалить аккаунт" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Удаление аккаунта" });

    await dialog.getByLabel("Текущий пароль").fill(user.password);
    await dialog.locator('input[type="checkbox"]').check();
    await dialog.getByRole("button", { name: "Удалить аккаунт" }).click();

    await expect(page).toHaveURL(/\/authorization$/);
    await expect(page.locator(".Notifications-success")).toContainText(
      "Аккаунт удалён. Вы вышли из системы.",
    );

    expect(await page.evaluate(() => window.localStorage.getItem("token"))).toBeNull();
    expect((await getProfileViaApi(token)).status).toBe(401);
  });
});


