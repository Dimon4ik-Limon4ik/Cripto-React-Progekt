const API_KEY = "CG-kuBTAsEac9yHn1KpVA58k7VE";

export async function getCrypto () {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&x_cg_demo_api_key=${API_KEY}`;

    const response = await fetch(url).catch(() => {
      throw new Error("NETWORK_ERROR");
    });

    if (!response.ok) {
      throw new Error(`HTTP_ERROR_${response.status}`);
    }

    const data = await response.json().catch(() => {
      throw new Error("PARSE_ERROR");
    });

    if (!Array.isArray(data)) {
      throw new Error("INVALID_DATA_FORMAT");
    }

    return data;

  } catch (err) {
    console.log(`В файле "cryptoApi.js" ошибка: ${err}`);
    return [];
  }
}