import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Process } from "@/util/process"
import { isRecord } from "@/util/record"

const LOG_DIR = path.join(os.homedir(), ".opencode", "logs")

export interface LlamaWorkerConfig {
  modelID: string
  modelPath: string
  port: number
  contextLength?: number
  binaryPath?: string
  /** Layers to offload to the GPU via -ngl. Omit to run on CPU only. */
  gpuLayers?: number
  flashAttention?: boolean
  fit?: boolean
  fitTargetMiB?: number
  reasoning?: boolean
  /** Quantize the KV cache to q8_0, roughly halving KV memory. */
  kvCacheQuantized?: boolean
  threads?: number
  /**
   * Number of server slots (-np). Each slot owns its own KV cache, so keeping
   * this at 1 for a single local model avoids multiplying KV memory. Omit to
   * let llama-server decide (auto).
   */
  slots?: number
  /** Maximum prompt cache size in MiB (--cache-ram). Default 2048. Set to 0 to disable. */
  cacheRam?: number
}

interface Worker {
  port: number
  signature: string
  proc?: Process.Child
}

const DEFAULT_BINARY = "llama-server"
const DEFAULT_CONTEXT_LENGTH = 16384
const HEALTH_TIMEOUT_MS = 120_000
const HEALTH_POLL_MS = 1_000

function logPath(port: number) {
  return path.join(LOG_DIR, `llama-server-${port}.log`)
}

/**
 * Builds the llama-server command line. Context is always set explicitly from
 * the model's configured limit so the KV cache is sized to what opencode will
 * actually send. When `fit` is enabled and no `gpuLayers` is given, llama.cpp
 * auto-tunes the offload to fit the model + KV cache into device memory.
 */
export function buildLlamaArgs(config: LlamaWorkerConfig): string[] {
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
  if (config.gpuLayers !== undefined) {
    args.push("-ngl", String(config.gpuLayers))
  }
  if (config.flashAttention !== undefined) args.push("--flash-attn", config.flashAttention ? "on" : "off")
  if (config.fit !== undefined) {
    args.push("--fit", config.fit ? "on" : "off")
    if (config.fitTargetMiB !== undefined) args.push("--fit-target", String(config.fitTargetMiB))
  }
  if (config.reasoning !== undefined) args.push("--reasoning", config.reasoning ? "on" : "off")
  if (config.kvCacheQuantized !== false) args.push("--cache-type-k", "q8_0", "--cache-type-v", "q8_0")
  if (config.threads !== undefined) args.push("-t", String(config.threads))
  if (config.slots !== undefined) args.push("-np", String(config.slots))
  if (config.cacheRam !== undefined) args.push("--cache-ram", String(config.cacheRam))
  return args
}

const LOG_TAIL_BYTES = 4096

/**
 * Reads the last N bytes of the llama-server log file to surface the actual
 * error when the process exits before becoming healthy.
 */
function readLogTail(port: number): string {
  try {
    const stat = fs.statSync(logPath(port))
    const fd = fs.openSync(logPath(port), "r")
    try {
      const readSize = Math.min(LOG_TAIL_BYTES, stat.size)
      const buffer = Buffer.alloc(readSize)
      fs.readSync(fd, buffer, 0, readSize, stat.size - readSize)
      return buffer.toString("utf-8")
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return ""
  }
}

/**
 * Scans the log tail for known llama-server error patterns and returns a
 * human-readable summary. Returns undefined when no recognizable error is found.
 */
function parseLlamaError(logTail: string): string | undefined {
  if (/cudaMalloc failed: out of memory/i.test(logTail)) {
    const match = logTail.match(/allocating ([\d.]+) MiB.*?(\d+) MiB free/)
    if (match) {
      return (
        `CUDA out of memory: tried to allocate ${match[1]} MiB, only ${match[2]} MiB free on GPU. ` +
        `Try reducing contextLength (e.g. 16384) or fitTargetMiB.`
      )
    }
    return "CUDA out of memory. Try reducing contextLength or fitTargetMiB."
  }
  if (/failed to create context/i.test(logTail)) {
    return "Failed to create llama context (model may be too large for available VRAM)."
  }
  if (/error while loading state/i.test(logTail)) {
    return "Error loading model state."
  }
  return undefined
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
    const signature = JSON.stringify({ modelPath: config.modelPath, args: buildLlamaArgs(config) })

    if (tracked && (await this.isHealthy(tracked.port))) {
      if (tracked.signature === signature && (await this.serves(tracked.port, config.modelPath))) return
      this.kill(config.modelID)
    }

    if (await this.isHealthy(config.port)) {
      if (await this.serves(config.port, config.modelPath)) {
        // A healthy server we did not spawn is serving this model: reuse it
        // without taking ownership, so it is not killed on shutdown.
        if (!tracked) {
          this.workers.set(config.modelID, { port: config.port, signature })
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
    const args = buildLlamaArgs(config)

    fs.mkdirSync(LOG_DIR, { recursive: true })
    const fd = fs.openSync(logPath(config.port), "a")
    const proc = Process.spawn([binary, ...args], { stdin: "ignore", stdout: fd, stderr: fd })
    this.workers.set(config.modelID, {
      port: config.port,
      signature: JSON.stringify({ modelPath: config.modelPath, args }),
      proc,
    })

    const deadline = Date.now() + HEALTH_TIMEOUT_MS
    const exited = proc.exited.then(
      () => true,
      () => true,
    )
    while (Date.now() < deadline) {
      if (proc.exitCode !== null || proc.signalCode !== null) {
        // Our spawn failed (e.g. the port was already bound), but a healthy
        // server may have taken over the port in the meantime (a concurrent
        // or orphaned process). Adopt it instead of failing.
        if ((await this.isHealthy(config.port)) && (await this.serves(config.port, config.modelPath))) {
          this.workers.set(config.modelID, {
            port: config.port,
            signature: JSON.stringify({ modelPath: config.modelPath, args }),
          })
          return
        }
        this.workers.delete(config.modelID)
        const tail = readLogTail(config.port)
        const detail = parseLlamaError(tail)
        throw new Error(
          `llama-server exited before becoming healthy (code ${proc.exitCode ?? "signal"})` +
            (detail ? `: ${detail}` : "") +
            `. Logs: ${logPath(config.port)}`,
        )
      }
      if (await this.isHealthy(config.port)) {
        if (await this.serves(config.port, config.modelPath)) return
      }
      // Fail fast if the spawned process died (e.g. missing binary) instead of
      // polling until HEALTH_TIMEOUT_MS.
      if (await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS))])) {
        this.workers.delete(config.modelID)
        const tail = readLogTail(config.port)
        const detail = parseLlamaError(tail)
        throw new Error(
          `llama-server exited before becoming healthy` +
            (detail ? `: ${detail}` : "") +
            `. Logs: ${logPath(config.port)}`,
        )
      }
    }

    this.kill(config.modelID)
    throw new Error(`Timed out waiting for llama-server on port ${config.port}. Logs: ${logPath(config.port)}`)
  }

  private kill(modelID: string) {
    const worker = this.workers.get(modelID)
    if (!worker) return
    this.workers.delete(modelID)
    if (!worker.proc) return
    const pid = worker.proc.pid
    if (!pid) return
    // Graceful shutdown: SIGTERM first, then SIGKILL if the worker does not
    // exit within a short window, so llama-server never lingers as a zombie
    // holding its port.
    try {
      process.kill(pid, "SIGTERM")
    } catch {
      return // already gone
    }
    setTimeout(() => {
      try {
        process.kill(pid, "SIGKILL")
      } catch {
        // already exited
      }
    }, 3_000)
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
