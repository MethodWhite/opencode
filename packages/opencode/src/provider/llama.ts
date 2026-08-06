import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Process } from "@/util/process"
import { isRecord } from "@/util/record"

export interface LlamaWorkerConfig {
  modelID: string
  modelPath: string
  port: number
  contextLength?: number
  binaryPath?: string
}

interface Worker {
  port: number
  proc?: Process.Child
}

const DEFAULT_BINARY = "llama-server"
const DEFAULT_CONTEXT_LENGTH = 65536
const HEALTH_TIMEOUT_MS = 120_000
const HEALTH_POLL_MS = 1_000

function logPath(port: number) {
  return path.join(os.tmpdir(), `llama-server-${port}.log`)
}

/**
 * Manages the lifecycle of local llama-server workers, one per llamacpp-local
 * model. Ensures the worker serving a model is healthy before the provider
 * issues a request against it, respawning it when the served model changes, and
 * tears everything down on shutdown.
 */
export class LlamaManager {
  private workers = new Map<string, Worker>()
  private spawning = new Map<string, Promise<void>>()

  ensure(config: LlamaWorkerConfig): Promise<void> {
    const pending = this.spawning.get(config.modelID)
    if (pending) return pending
    // Serialize concurrent callers so only one spawn happens per model; the
    // second caller reuses the in-flight result instead of racing a duplicate
    // process on the same port.
    const run = this.ensureUnsafe(config).finally(() => this.spawning.delete(config.modelID))
    this.spawning.set(config.modelID, run)
    return run
  }

  private async ensureUnsafe(config: LlamaWorkerConfig): Promise<void> {
    const tracked = this.workers.get(config.modelID)

    if (tracked && (await this.isHealthy(tracked.port))) {
      if (await this.serves(tracked.port, config.modelPath)) return
      this.kill(config.modelID)
    }

    if (await this.isHealthy(config.port)) {
      if (await this.serves(config.port, config.modelPath)) {
        // A healthy server we did not spawn is serving this model: reuse it
        // without taking ownership, so it is not killed on shutdown.
        if (!tracked) {
          this.workers.set(config.modelID, { port: config.port })
        }
        return
      }
      throw new Error(
        `Port ${config.port} is serving a different model than ${path.basename(config.modelPath)}. ` +
          `Free the port or stop that llama-server before selecting this model.`,
      )
    }

    await this.spawn(config)
  }

  async isHealthy(port: number): Promise<boolean> {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`)
      return res.ok
    } catch {
      return false
    }
  }

  private async serves(port: number, modelPath: string): Promise<boolean> {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/props`)
      if (!res.ok) return false
      const body: unknown = await res.json()
      const served = isRecord(body) ? body.model_path : undefined
      return typeof served === "string" && served.endsWith(path.basename(modelPath))
    } catch {
      return false
    }
  }

  private async spawn(config: LlamaWorkerConfig): Promise<void> {
    const binary = config.binaryPath || DEFAULT_BINARY
    const args = [
      "--host",
      "127.0.0.1",
      "--port",
      String(config.port),
      "-m",
      config.modelPath,
      "-c",
      String(config.contextLength ?? DEFAULT_CONTEXT_LENGTH),
      "--alias",
      config.modelID,
    ]

    const fd = fs.openSync(logPath(config.port), "a")
    const proc = Process.spawn([binary, ...args], { stdin: "ignore", stdout: fd, stderr: fd })
    this.workers.set(config.modelID, { port: config.port, proc })

    const deadline = Date.now() + HEALTH_TIMEOUT_MS
    while (Date.now() < deadline) {
      if (proc.exitCode !== null || proc.signalCode !== null) {
        // Our spawn failed (e.g. the port was already bound), but a healthy
        // server may have taken over the port in the meantime (a concurrent
        // or orphaned process). Adopt it instead of failing.
        if ((await this.isHealthy(config.port)) && (await this.serves(config.port, config.modelPath))) {
          this.workers.set(config.modelID, { port: config.port })
          return
        }
        this.workers.delete(config.modelID)
        throw new Error(
          `llama-server exited before becoming healthy (code ${proc.exitCode ?? "signal"}). Logs: ${logPath(config.port)}`,
        )
      }
      if (await this.isHealthy(config.port)) {
        if (await this.serves(config.port, config.modelPath)) return
      }
      await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS))
    }

    this.kill(config.modelID)
    throw new Error(`Timed out waiting for llama-server on port ${config.port}. Logs: ${logPath(config.port)}`)
  }

  private kill(modelID: string) {
    const worker = this.workers.get(modelID)
    if (!worker) return
    this.workers.delete(modelID)
    if (!worker.proc) return
    if (worker.proc.pid) {
      try {
        process.kill(worker.proc.pid, "SIGTERM")
      } catch {
        // already gone
      }
    }
  }

  stop(modelID: string) {
    this.kill(modelID)
  }

  stopAll() {
    for (const modelID of this.workers.keys()) {
      this.kill(modelID)
    }
  }
}