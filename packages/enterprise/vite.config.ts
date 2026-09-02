// NOT VALIDATED END-TO-END (no sst dev / wrangler deploy access from this session).
// See packages/console/app/vite.config.ts for the full rationale -- same rewrite,
// same requirement that package.json run this via the `vinxi` CLI, not `vite`.
// host/port move to CLI flags (see package.json); tailwindcss()/worker are plain
// Vite options so they go through the `vite` passthrough.
import { defineConfig } from "@solidjs/start/config"
import tailwindcss from "@tailwindcss/vite"

const nitroConfig: Record<string, unknown> = (() => {
  const target = process.env.OPENCODE_DEPLOYMENT_TARGET
  if (target === "cloudflare") {
    return {
      compatibilityDate: "2024-09-19",
      preset: "cloudflare-module",
      cloudflare: {
        nodeCompat: true,
      },
    }
  }
  return {}
})()

export default defineConfig({
  server: {
    ...nitroConfig,
    baseURL: process.env.OPENCODE_BASE_URL,
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: true,
    },
    worker: {
      format: "es",
    },
  },
})
