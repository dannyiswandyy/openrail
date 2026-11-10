import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Settings recommended for Tauri: fixed port, no screen clearing.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: { target: "es2021", outDir: "dist" },
});
