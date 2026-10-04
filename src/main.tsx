import "./polyfills";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Web3Provider } from "./components/Web3Provider";
import { ThemeProvider } from "./hooks/useTheme";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <Web3Provider>
      <App />
    </Web3Provider>
  </ThemeProvider>
);
