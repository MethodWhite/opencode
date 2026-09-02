// NOT VALIDATED END-TO-END (no sst dev / wrangler deploy access from this session).
// See packages/console/app/vite.config.ts for the full rationale -- same rewrite,
// same requirement that package.json run this via the `vinxi` CLI, not `vite`.
// `base: "/data/"` isn't exposed by SolidStartInlineConfig or its vite passthrough;
// nitropack's NitroConfig (the `server` field below) has its own `baseURL`, which is
// the closest equivalent -- unverified against an actual deploy.
import { defineConfig } from "@solidjs/start/config"

export default defineConfig({
  server: {
    baseURL: "/data/",
    compatibilityDate: "2024-09-19",
    preset: "cloudflare-module",
    cloudflare: {
      nodeCompat: true,
    },
  },
  vite: {
    server: {
      allowedHosts: true,
    },
    build: {
      minify: "esbuild",
      cssMinify: true,
    },
  },
})
