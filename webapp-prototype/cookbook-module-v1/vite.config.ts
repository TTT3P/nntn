import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cookbookSotPlugin } from "./dev/cookbookSotPlugin.ts";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const defaultVaultRoot = resolve(moduleDirectory, "../../../../../..", "vault/nntn");

export default defineConfig({
  base: "/nntn-cookbook/",
  plugins: [
    react(),
    cookbookSotPlugin({
      vaultRoot: process.env.NNTN_VAULT_ROOT ?? defaultVaultRoot,
    }),
  ],
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}", "dev/**/*.{test,spec}.ts"],
    setupFiles: "./src/test/setup.ts",
  },
});
