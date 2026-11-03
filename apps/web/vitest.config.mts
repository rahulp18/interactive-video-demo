import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    // Integration tests share one database; run files serially.
    fileParallelism: false,
    // Inline `next` so vi.mock("next/server") also intercepts imports made from route handlers.
    server: { deps: { inline: [/node_modules[\/]next[\/]/] } },
  },
});
