import { useFavorites } from "../../../Context/FavoritesContext.jsx";
import "./Star.css";

export default function Star({ CryptaId, className = "" }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = Boolean(CryptaId) && isFavorite(CryptaId);

  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavorite(CryptaId);
  };

  // Не даём Enter/Space всплыть до карточки — иначе она откроет страницу
  // монеты. Сам клик кнопки браузер сгенерирует автоматически.
  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.stopPropagation();
    }
  };

  return (
    <button
      type="button"
      className={`star ${active ? "starActive" : ""} ${className}`.trim()}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-pressed={active}
      aria-label={active ? "Убрать из избранного" : "Добавить в избранное"}
      title={active ? "Убрать из избранного" : "Добавить в избранное"}
    >
      star
    </button>
  );
}
