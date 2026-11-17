import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Dos páginas en el build: la app y la vista previa de Life line.
  build: {
    rollupOptions: {
      input: { main: "index.html", lifeline: "lifeline.html" },
    },
  },
});
