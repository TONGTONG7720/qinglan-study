import "@fontsource/ibm-plex-mono/latin-500.css";
import "./styles/tokens.css";
import "./styles/global.css";
import "./features/auth/auth.css";
import "./features/system/system-state.css";
import "./features/routes/planned-surface.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./app";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Missing root element");
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
