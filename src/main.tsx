import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ChartsLab } from "./charts/ChartsLab";
import "./styles.css";

function Root() {
  const [isCharts, setIsCharts] = useState(() => window.location.hash === "#charts");

  useEffect(() => {
    const handleHashChange = () => {
      setIsCharts(window.location.hash === "#charts");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return isCharts ? <ChartsLab /> : <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);

