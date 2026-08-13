const SECRET = "[REDACTED]"

interface Pattern {
  regex: RegExp
  replace: (head: string, open: string, secret: string, tail: string) => string
}

const SECRET_PATTERNS: ReadonlyArray<Pattern> = [
  // echo/printf '<secret>' | sudo -S ... (the classic password leak)
  {
    regex: /(\b(?:echo|printf)\s+)(['"])([^'"]{1,128}?)\2(\s*\|\s*sudo\s+-S)/gi,
    replace: (head, open, secret, tail) => `${head}${open}${SECRET}${open}${tail}`,
  },
  // password= / passwd= / pwd= assignment with a value (handles DB_PASSWORD=, API_TOKEN=, etc.)
  {
    regex: /((?:^|[\s;|&])[A-Za-z0-9_-]*(?:password|passwd|pwd)\s*[=:]\s*)(['"]?)([^\s'";&|,}]{1,128})\2/gi,
    replace: (head, open, secret, tail) => `${head}${open}${SECRET}${open}${tail}`,
  },
  // api key / secret / token assignments
  {
    regex: /\b((?:api[_-]?key|secret|token|auth)[_-]?(?:key)?\s*[=:]\s*)(['"]?)([^\s'";&|,}]{1,128})\2/gi,
    replace: (head, open, secret, tail) => `${head}${open}${SECRET}${open}${tail}`,
  },
  // Authorization / Bearer tokens
  {
    regex: /\b((?:authorization|proxy-authorization)\s*:\s*(?:bearer|basic)\s+)([A-Za-z0-9._~+/=-]+)/gi,
    replace: (head, open, secret, tail) => `${head}${SECRET}`,
  },
  // PEM private keys
  {
    regex: /(-----BEGIN [A-Z ]*PRIVATE KEY-----)([^]*?)(-----END [A-Z ]*PRIVATE KEY-----)/gi,
    replace: (head, open, secret, tail) => `${head}${SECRET}${tail}`,
  },
]

export function redact(value: unknown): unknown {
  if (typeof value === "string") return redactString(value)
  if (Array.isArray(value)) return value.map((item) => redact(item))
  if (isRecord(value)) {
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      result[key] = isSensitiveKey(key) ? SECRET : redact(item)
    }
    return result
  }
  return value
}

function redactString(value: string): string {
  let output = value
  for (const { regex, replace } of SECRET_PATTERNS) {
    output = output.replace(regex, (match, g1, g2, g3, g4) =>
      typeof g1 === "string" && typeof g2 === "string" && typeof g3 === "string"
        ? replace(g1, g2, g3, typeof g4 === "string" ? g4 : "")
        : match,
    )
  }
  return output
}

function isSensitiveKey(key: string): boolean {
  return /password|passwd|secret|token|api[_-]?key|authorization|private[_ -]?key|credential/i.test(key)
}

function isRecord(input: unknown): input is Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return false
  const prototype = Object.getPrototypeOf(input)
  return prototype === Object.prototype || prototype === null
}

export * as Redact from "./redact"
