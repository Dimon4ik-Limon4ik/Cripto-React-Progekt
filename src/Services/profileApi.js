// Запросы страницы профиля: данные аккаунта, смена пароля и удаление.
const AUTH_API_URL = "http://localhost:3000/auth";

export class ProfileApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ProfileApiError";
    this.status = status;
  }
}

async function request(path, { method = "GET", token, body } = {}) {
  let response;

  try {
    response = await fetch(`${AUTH_API_URL}${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ProfileApiError(
      "Не удалось подключиться к серверу. Попробуйте ещё раз.",
      0,
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ProfileApiError(
      data.error || "Не удалось выполнить запрос.",
      response.status,
    );
  }

  return data;
}

export async function getProfile(token) {
  const data = await request("/profile", { token });
  return data.user;
}

export function changePassword(token, values) {
  return request("/changePassword", {
    method: "PATCH",
    token,
    body: values,
  });
}

export function deleteAccount(token, password) {
  return request("/deleteAccount", {
    method: "DELETE",
    token,
    body: { password },
  });
}
