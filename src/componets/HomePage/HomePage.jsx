import "./HomePage.css";
import TypeWriterText from "./TypeWriterText/TypeWriterText.jsx";
import CriptoCard from "./CriptoCard/CriptoCard.jsx";
import TopGainersTicker from "./TopGainersTicker/TopGainersTicker.jsx";
import TopLosersTicker from "./TopLosersTicker/TopLosersTicker.jsx";
import { CriptoContext } from "./../../Context/CriptoContext.js";
import { ThemeContext } from "./../../Context/SunMoonContext.js";
import { useContext, useState } from "react";


export default function HomePage({ status = "ready", onRetry }) {
  let CryptaCardArray = [];
  const crypta = useContext(CriptoContext);
  const { theme } = useContext(ThemeContext);
  const [SearchValue, setSearchValue] = useState("");

  if (SearchValue === "") {
    CryptaCardArray = crypta.map((coin) => {
      return (
        <CriptoCard
          key={coin.id}
          CryptaId={coin.id}
          CryptaImg={coin?.image}
          CryptaName={coin?.name}
          CryptaPrace={coin?.current_price}
          CryptaHeightСhange={coin?.price_change_percentage_24h}
        />
      );
    });
  } else {
    CryptaCardArray = crypta.map((coin) => {
      if (coin.name.toLowerCase().startsWith(SearchValue.toLowerCase())) {
        return (
          <CriptoCard
            key={coin.id}
            CryptaId={coin.id}
            CryptaImg={coin?.image}
            CryptaName={coin?.name}
            CryptaPrace={coin?.current_price}
            CryptaHeightСhange={coin?.price_change_percentage_24h}
          />
        );
      }
    });
  }

  if (!crypta || crypta.length === 0) {
    return (
      <>
        <div className={theme === true ? "Conten " : "Conten Conten-dark"}>
          <div className="Cripta">
            <TypeWriterText />
            <input
              type="search"
              className="CriptoSearch"
              placeholder="Поиск монеты"
              aria-label="Поиск монеты"
            />
            <div className="pageConten">
              {status === "error" ? (
                <>
                  <p>Не удалось загрузить котировки.</p>
                  <button
                    type="button"
                    className="portfolioEmptyBtn"
                    onClick={onRetry}
                  >
                    Повторить
                  </button>
                </>
              ) : (
                <p>Загрузка...</p>
              )}
            </div>
          </div>
        </div>
        <TopGainersTicker />
        <TopLosersTicker />
      </>
    );
  }

  return (
    <>
      <div className={theme === true ? "Conten " : "Conten Conten-dark"}>
        <div className="Cripta">
          <TypeWriterText />
          <input
            type="search"
            value={SearchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
            }}
            className="CriptoSearch"
            placeholder="Поиск монеты"
            aria-label="Поиск монеты"
          />
          <div className="pageConten">{CryptaCardArray}</div>
        </div>
      </div>
      <TopGainersTicker />
      <TopLosersTicker />
    </>
  );
}
