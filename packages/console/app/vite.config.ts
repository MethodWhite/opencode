// NOT VALIDATED END-TO-END (no sst dev / wrangler deploy access from this session).
// @solidjs/start/config's `solidStart()` Vite-plugin export never existed on npm
// (checked every published 0.7.7-1.3.2 release) -- only `defineConfig()`, which
// returns a Vinxi App, not a Vite PluginOption. This rewrites the config to that
// API. It also requires "dev"/"build"/"start" in package.json to run via the
// `vinxi` CLI instead of `vite` directly -- see that file's diff alongside this one.
import { defineConfig } from "@solidjs/start/config"

export default defineConfig({
  middleware: "./src/middleware.ts",
  // Maps to nitropack's NitroConfig -- replaces the old nitro() Vite plugin.
  server: {
    compatibilityDate: "2024-09-19",
    preset: "cloudflare-module",
    cloudflare: {
      nodeCompat: true,
    },
  },
  vite: {
    // port/host/strictPort are intentionally excluded from this vite.server passthrough
    // by @solidjs/start's own types; pass them as `vinxi dev --port 3001 --host` instead
    // (see package.json).
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
