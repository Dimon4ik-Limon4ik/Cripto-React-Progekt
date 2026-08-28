import { useState } from "react";
import "./Star.css";
export default function Star() {
  const [stateStar, setActiveStar] = useState(false);
  return (
    <span
      className={stateStar ? "star starActive" : "star"}
      onClick={() =>{setActiveStar(!stateStar)} }
    >
      star
    </span>
  );
}
