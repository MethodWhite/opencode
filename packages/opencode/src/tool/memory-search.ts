import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import DESCRIPTION from "./memory-search.txt"

export const Parameters = Schema.Struct({
  query: Schema.String.annotate({ description: "What to search for in past sessions" }),
  max_results: Schema.optional(Schema.Number).annotate({ description: "Max results (default 5)" }),
})

export const MemorySearchTool = Tool.define<typeof Parameters, {}, {}>(
  "memory-search",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>) =>
        Effect.gen(function* () {
          return {
            title: `Memory search: ${params.query}`,
            output: [
              `Searching for: "${params.query}"`,
              "",
              "For full cross-session memory, configure the synapsis MCP server:",
              "  https://github.com/MethodWhite/synapsis",
              "",
              "The current session has all context available in the conversation.",
            ].join("\n"),
            metadata: {},
          }
        }),
    } satisfies Tool.DefWithoutID<typeof Parameters, {}>
  }),
)
