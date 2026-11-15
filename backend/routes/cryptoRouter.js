import express from "express";
import TokenCheck from "./../middleware/TokenCheck.js";
import getCryptoMarkets from "../controllers/getCryptoMarkets.js";
import getTopGainers from "../controllers/getTopGainers.js";
import getTopLosers from "../controllers/getTopLosers.js";

const router = express.Router();

router.get("/markets", TokenCheck, getCryptoMarkets);
router.get("/top-gainers", TokenCheck, getTopGainers);
router.get("/top-losers", TokenCheck, getTopLosers);

export default router;