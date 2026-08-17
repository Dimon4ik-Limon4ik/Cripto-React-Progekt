import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import BackgroundLayout from "./BackgroundLayout.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <BackgroundLayout />
    </BrowserRouter>
  </StrictMode>,
);
