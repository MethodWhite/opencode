// NOT VALIDATED END-TO-END (no sst dev / wrangler deploy access from this session).
// See packages/console/app/vite.config.ts for the full rationale -- same rewrite,
// same requirement that package.json run this via the `vinxi` CLI, not `vite`.
import { defineConfig } from "@solidjs/start/config"

export default defineConfig({
  server: {
    compatibilityDate: "2024-09-19",
    preset: "cloudflare_module",
    cloudflare: {
      nodeCompat: true,
    },
  },
  vite: {
    server: {
      allowedHosts: true,
    },
    build: {
      rollupOptions: {
        external: ["cloudflare:workers"],
      },
      minify: false,
    },
  },
})
