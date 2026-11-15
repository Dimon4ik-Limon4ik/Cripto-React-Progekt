// Персональное избранное пользователя: запросы к защищённому API.
const FAVORITES_API_URL = "http://localhost:3000/favorites";

export class FavoritesApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "FavoritesApiError";
    this.status = status;
  }
}

async function request(path = "", { method = "GET", token, body } = {}) {
  let response;

  try {
    response = await fetch(`${FAVORITES_API_URL}${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new FavoritesApiError(
      "Не удалось подключиться к серверу. Попробуйте ещё раз.",
      0,
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new FavoritesApiError(
      data.error || "Не удалось выполнить запрос.",
      response.status,
    );
  }

  return Array.isArray(data.favorites) ? data.favorites : [];
}

export function getFavorites(token) {
  return request("", { token });
}

export function addFavorite(token, coinId) {
  return request("", { method: "POST", token, body: { coinId } });
}

export function removeFavorite(token, coinId) {
  return request(`/${encodeURIComponent(coinId)}`, { method: "DELETE", token });
}

export function clearFavorites(token) {
  return request("", { method: "DELETE", token });
}