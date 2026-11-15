import express from "express";
import getCryptoMarkets from "../controllers/getCryptoMarkets.js";
import getCryptoById from "../controllers/getCryptoById.js";
import getCryptoMarketChart from "../controllers/getCryptoMarketChart.js";
import getTopGainers from "../controllers/getTopGainers.js";
import getTopLosers from "../controllers/getTopLosers.js";

const router = express.Router();

// Данные CoinGecko публичны, а API-ключ остаётся только на сервере.
// Клиент не хранит ключ и обращается к этим прокси-эндпоинтам.
router.get("/markets", getCryptoMarkets);
router.get("/top-gainers", getTopGainers);
router.get("/top-losers", getTopLosers);
router.get("/coin/:coinId", getCryptoById);
router.get("/chart/:coinId", getCryptoMarketChart);

export default router;