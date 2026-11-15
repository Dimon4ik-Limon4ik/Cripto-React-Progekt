import getUserFavorites from "../services/getUserFavorites.js";

export default async function getFavorites(req, res) {
  try {
    const favorites = await getUserFavorites(req.user.userId);
    return res.status(200).json({ favorites });
  } catch (error) {
    console.error("Ошибка загрузки избранного:", error.code ?? error.message);
    return res.status(500).json({ error: "Не удалось загрузить избранное" });
  }
}