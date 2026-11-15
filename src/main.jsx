import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./Palette.css";
import "./index.css";
import BackgroundLayout from "./BackgroundLayout.jsx";
import { AuthProvider } from "./Context/AuthContext.jsx";
import { NotificationsProvider } from "./Context/NotificationsContext.jsx";
import { FavoritesProvider } from "./Context/FavoritesContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <NotificationsProvider>
        <AuthProvider>
          <FavoritesProvider>
            <BackgroundLayout />
          </FavoritesProvider>
        </AuthProvider>
      </NotificationsProvider>
    </BrowserRouter>
  </StrictMode>,
);
