import { EOL } from "os"
import { Schema } from "effect"
import { logo as glyphs } from "./logo"

const wordmark = [
  `⠀                                ▄     `,
  `█▀▀█ █▀▀█ █▀▀█ █▀▀▄ █▀▀▀ █▀▀█ █▀▀█ █▀▀█`,
  `█  █ █  █ █▀▀▀ █  █ █    █  █ █  █ █▀▀▀`,
  `▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀  ▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀`,
]

export class CancelledError extends Schema.TaggedErrorClass<CancelledError>()("UICancelledError", {}) {}

// Color is disabled when NO_COLOR is set (https://no-color.org), FORCE_COLOR
// is explicitly "0", or neither stdout nor stderr is a TTY.
function colorEnabled(): boolean {
  if (process.env.FORCE_COLOR !== undefined) return process.env.FORCE_COLOR !== "0"
  if (process.env.NO_COLOR !== undefined) return false
  return process.stdout.isTTY || process.stderr.isTTY
}

const COLOR = colorEnabled()

export const Style = {
  TEXT_HIGHLIGHT: COLOR ? "\x1b[96m" : "",
  TEXT_HIGHLIGHT_BOLD: COLOR ? "\x1b[96m\x1b[1m" : "",
  TEXT_DIM: COLOR ? "\x1b[90m" : "",
  TEXT_DIM_BOLD: COLOR ? "\x1b[90m\x1b[1m" : "",
  TEXT_NORMAL: COLOR ? "\x1b[0m" : "",
  TEXT_NORMAL_BOLD: COLOR ? "\x1b[1m" : "",
  TEXT_WARNING: COLOR ? "\x1b[93m" : "",
  TEXT_WARNING_BOLD: COLOR ? "\x1b[93m\x1b[1m" : "",
  TEXT_DANGER: COLOR ? "\x1b[91m" : "",
  TEXT_DANGER_BOLD: COLOR ? "\x1b[91m\x1b[1m" : "",
  TEXT_SUCCESS: COLOR ? "\x1b[92m" : "",
  TEXT_SUCCESS_BOLD: COLOR ? "\x1b[92m\x1b[1m" : "",
  TEXT_INFO: COLOR ? "\x1b[94m" : "",
  TEXT_INFO_BOLD: COLOR ? "\x1b[94m\x1b[1m" : "",
}

export function println(...message: string[]) {
  print(...message)
  process.stderr.write(EOL)
}

export function print(...message: string[]) {
  blank = false
  process.stderr.write(message.join(" "))
}

let blank = false
export function empty() {
  if (blank) return
  println("" + Style.TEXT_NORMAL)
  blank = true
}

export function logo(pad?: string) {
  if (!COLOR) {
    const result = []
    for (const row of wordmark) {
      if (pad) result.push(pad)
      result.push(row)
      result.push(EOL)
    }
    return result.join("").trimEnd()
  }

  const result: string[] = []
  const reset = "\x1b[0m"
  const left = {
    fg: "\x1b[90m",
    shadow: "\x1b[38;5;235m",
    bg: "\x1b[48;5;235m",
  }
  const right = {
    fg: reset,
    shadow: "\x1b[38;5;238m",
    bg: "\x1b[48;5;238m",
  }
  const gap = " "
  const draw = (line: string, fg: string, shadow: string, bg: string) => {
    const parts: string[] = []
    for (const char of line) {
      if (char === "_") {
        parts.push(bg, " ", reset)
        continue
      }
      if (char === "^") {
        parts.push(fg, bg, "▀", reset)
        continue
      }
      if (char === "~") {
        parts.push(shadow, "▀", reset)
        continue
      }
      if (char === " ") {
        parts.push(" ")
        continue
      }
      parts.push(fg, char, reset)
    }
    return parts.join("")
  }
  glyphs.left.forEach((row, index) => {
    if (pad) result.push(pad)
    result.push(draw(row, left.fg, left.shadow, left.bg))
    result.push(gap)
    const other = glyphs.right[index] ?? ""
    result.push(draw(other, right.fg, right.shadow, right.bg))
    result.push(EOL)
  })
  return result.join("").trimEnd()
}

export async function input(prompt: string): Promise<string> {
  const readline = require("readline")
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(prompt, (answer: string) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export function error(message: string) {
  if (message.startsWith("Error: ")) {
    message = message.slice("Error: ".length)
  }
  println(Style.TEXT_DANGER_BOLD + "Error: " + Style.TEXT_NORMAL + message)
}

export function markdown(text: string): string {
  return text
}

export * as UI from "./ui"
