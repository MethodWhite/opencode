import { afterAll, describe, expect, test } from "bun:test"
import { createServer, type Server } from "node:http"

import { LlamaManager } from "../../src/provider/llama"

/**
 * A fake llama-server: serves `/health` and `/props` on loopback so the
 * LlamaManager's health/props logic can be exercised without a real
 * llama-server binary or model.
 */
function fakeLlamaServer(modelPath: string, healthy = true): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    if (req.url?.startsWith("/health")) {
      res.writeHead(healthy ? 200 : 503)
      res.end(healthy ? '{"status":"ok"}' : '{"status":"error"}')
      return
    }
    if (req.url?.startsWith("/props")) {
      res.writeHead(200)
      res.end(JSON.stringify({ model_path: modelPath }))
      return
    }
    res.writeHead(404)
    res.end()
  })
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address()
      resolve({ server, port: typeof addr === "object" && addr ? addr.port : 0 })
    })
  })
}

describe("LlamaManager", () => {
  const servers: Server[] = []
  const manager = new LlamaManager()

  async function withServer(modelPath: string, healthy = true) {
    const { server, port } = await fakeLlamaServer(modelPath, healthy)
    servers.push(server)
    return { port, modelPath }
  }

  afterAll(() => {
    manager.stopAll()
    for (const server of servers) server.close()
  })

  test("reuses a healthy server already serving the model", async () => {
    const { port, modelPath } = await withServer("/models/foo.gguf")
    const config = {
      modelID: "foo",
      modelPath,
      port,
      binaryPath: "/nonexistent/bin/never-used",
    }
    // A healthy external server serving the right model should be adopted
    // without spawning the binary.
    await manager.ensure(config)
    expect(manager.isHealthy(port)).resolves.toBe(true)
  })

  test("throws when the port serves a different model", async () => {
    const { port, modelPath } = await withServer("/models/other.gguf")
    const config = {
      modelID: "bar",
      modelPath: "/models/foo.gguf",
      port,
      binaryPath: "/nonexistent/bin/never-used",
    }
    await expect(manager.ensure(config)).rejects.toThrow(/different model/)
  })

  test("does not adopt an unhealthy server on the port", async () => {
    const { port, modelPath } = await withServer("/models/foo.gguf", false)
    const config = {
      modelID: "foo-unhealthy",
      modelPath,
      port,
      binaryPath: "/nonexistent/bin/never-used",
    }
    // Unhealthy port → the manager tries to spawn; with a bogus binary it
    // must fail rather than silently adopt a dead server.
    await expect(manager.ensure(config)).rejects.toThrow()
  })
})
