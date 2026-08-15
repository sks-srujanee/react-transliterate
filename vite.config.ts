import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "src/index.tsx",
      formats: ["cjs", "es"],
      // `main` and `module` in package.json point at these
      fileName: (format) => (format === "es" ? "index.modern.js" : "index.js"),
      cssFileName: "index",
    },
    sourcemap: true,
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "textarea-caret"],
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test-setup.ts",
  },
});
