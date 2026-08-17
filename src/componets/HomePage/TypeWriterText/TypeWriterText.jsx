import "./TypeWriterText.css";
import { useState, useEffect } from "react";

const cryptoNames = [
  "Bitcoin",
  "Ethereum",
  "Tether",
  "BNB",
  "Solana",
  "XRP",
  "USDC",
  "Cardano",
  "Dogecoin",
  "Avalanche",
  "TRON",
  "Chainlink",
  "Polygon",
  "Polkadot",
  "Wrapped Bitcoin",
  "Toncoin",
  "Shiba Inu",
  "Litecoin",
  "Bitcoin Cash",
  "Near Protocol",
];

export default function TypeWriterText() {
  const [displayedText, setDisplayedText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = cryptoNames[wordIndex];

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          setDisplayedText(currentWord.slice(0, displayedText.length + 1));

          if (displayedText.length === currentWord.length) {
            setTimeout(() => setIsDeleting(true), 1200);
          }
        } else {
          setDisplayedText(currentWord.slice(0, displayedText.length - 1));

          if (displayedText.length - 1 === 0) {
            setIsDeleting(false);
            setWordIndex((prev) => {
              if (prev < cryptoNames.length - 1) {
                return prev + 1;
              } else {
                return 0;
              }
            });
          }
        }
      },
      isDeleting ? 60 : 120,
    );

    return () => clearTimeout(timeout);
  }, [displayedText, isDeleting, wordIndex]);

  return (
    <div className="heroContent">
      <h1>
        Найди любую криптовалюту <br />
        <span className="typewriterText">
          {displayedText}
          <span className="Cursor">|</span>
        </span>
      </h1>
    </div>
  );
}
