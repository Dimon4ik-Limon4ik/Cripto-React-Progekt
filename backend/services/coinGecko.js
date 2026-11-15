// Единая точка запросов к CoinGecko: API-ключ остаётся на сервере,
// а контроллеры получают либо данные, либо готовый код ошибки.
const API_BASE = "https://api.coingecko.com/api/v3";

export const INVALID_FORMAT_ERROR = "Некорректный формат данных от CoinGecko";
export const NETWORK_ERROR = "Не удалось получить данные от CoinGecko";

function buildUrl(path) {
  const separator = path.includes("?") ? "&" : "?";
  const apiKey = encodeURIComponent(process.env.COINGECKO_API_KEY ?? "");

  return `${API_BASE}${path}${separator}x_cg_demo_api_key=${apiKey}`;
}

// Возвращает { data } при успехе и { status, error } при сбое.
export async function coinGeckoGet(path) {
  let response;

  try {
    response = await fetch(buildUrl(path));
  } catch (err) {
    // В лог — только код/сообщение: URL содержит API-ключ.
    console.error(
      "Ошибка запроса к CoinGecko:",
      err?.cause?.code ?? err?.code ?? err?.message,
    );
    return { status: 502, error: NETWORK_ERROR };
  }

  if (!response.ok) {
    // 5xx внешнего API — это 502 Bad Gateway, а не наша внутренняя ошибка.
    const status = response.status >= 500 ? 502 : response.status;
    return {
      status,
      error: `Ошибка CoinGecko API: HTTP ${response.status}`,
    };
  }

  try {
    return { data: await response.json() };
  } catch (err) {
    console.error("Ошибка разбора ответа CoinGecko:", err?.code ?? err?.message);
    return { status: 502, error: INVALID_FORMAT_ERROR };
  }
}
