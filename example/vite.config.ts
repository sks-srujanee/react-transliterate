import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // relative paths so the build works on github pages
  base: "./",
  resolve: {
    // the library is a symlink, so react has to resolve to a single copy
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 3000,
  },
});
