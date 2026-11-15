import express from "express";
import TokenCheck from "../middleware/TokenCheck.js";
import validateFavoriteCoin from "../middleware/validateFavoriteCoin.js";
import getFavorites from "../controllers/getFavorites.js";
import addFavorite from "../controllers/addFavorite.js";
import removeFavorite from "../controllers/removeFavorite.js";
import clearFavorites from "../controllers/clearFavorites.js";

const router = express.Router();

// Избранное всегда привязано к пользователю из JWT.
router.get("/", TokenCheck, getFavorites);
router.post("/", TokenCheck, validateFavoriteCoin, addFavorite);
router.delete("/", TokenCheck, clearFavorites);
router.delete("/:coinId", TokenCheck, validateFavoriteCoin, removeFavorite);

export default router;