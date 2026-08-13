/** Plain-record narrowing. Excludes arrays so JSON object checks don't accept tuples as key/value bags. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
