import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev proxy lets `npm run dev` work against the local API without CORS setup.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
