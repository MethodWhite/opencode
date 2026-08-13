import { afterAll, describe, expect, test } from "bun:test"
import { createServer, type Server } from "node:http"

import { buildLlamaArgs, LlamaManager } from "../../src/provider/llama"

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

describe("buildLlamaArgs", () => {
  const base = {
    modelID: "qwen",
    modelPath: "/models/qwen.gguf",
    port: 8080,
  }

  test("sizes context from the configured limit by default", () => {
    const args = buildLlamaArgs({ ...base, contextLength: 32768 })
    expect(args).toContain("-c")
    expect(args[args.indexOf("-c") + 1]).toBe("32768")
  })

  test("respects fit without offload so llama.cpp auto-tunes to VRAM", () => {
    const args = buildLlamaArgs({ ...base, contextLength: 32768, fit: true, fitTargetMiB: 512 })
    expect(args).toContain("--fit")
    expect(args[args.indexOf("--fit") + 1]).toBe("on")
    expect(args).toContain("--fit-target")
    expect(args[args.indexOf("--fit-target") + 1]).toBe("512")
    expect(args).not.toContain("-ngl")
  })

  test("passes an explicit offload when gpuLayers is given", () => {
    const args = buildLlamaArgs({ ...base, gpuLayers: 24 })
    expect(args).toContain("-ngl")
    expect(args[args.indexOf("-ngl") + 1]).toBe("24")
  })

  test("quantizes the KV cache by default and allows opting out", () => {
    expect(buildLlamaArgs({ ...base })).toContain("--cache-type-k")
    const off = buildLlamaArgs({ ...base, kvCacheQuantized: false })
    expect(off).not.toContain("--cache-type-k")
  })

  test("defaults to a single slot so the KV cache is not multiplied", () => {
    expect(buildLlamaArgs({ ...base, slots: 1 })).toContain("-np")
  })

  test("omits optional memory flags when unset", () => {
    const args = buildLlamaArgs({ ...base })
    for (const flag of ["--flash-attn", "--fit", "--reasoning", "-np", "-t"]) {
      expect(args).not.toContain(flag)
    }
  })
})
