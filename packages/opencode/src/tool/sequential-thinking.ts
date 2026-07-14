import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import DESCRIPTION from "./sequential-thinking.txt"

const Thought = Schema.Struct({
  thought: Schema.String.annotate({ description: "Your current thinking step" }),
  thoughtNumber: Schema.Number.annotate({ description: "Current thought number (1, 2, 3, ...)" }),
  totalThoughts: Schema.Number.annotate({ description: "Estimated total thoughts needed" }),
  nextThoughtNeeded: Schema.Boolean.annotate({ description: "Whether another thought step is needed" }),
  isRevision: Schema.optional(Schema.Boolean).annotate({
    description: "Whether this revises a previous thought",
  }),
  revisesThought: Schema.optional(Schema.Number).annotate({
    description: "Which thought is being reconsidered (if isRevision=true)",
  }),
  branchFromThought: Schema.optional(Schema.Number).annotate({
    description: "Branching point thought number (if branching)",
  }),
  branchId: Schema.optional(Schema.String).annotate({
    description: "Branch identifier (if branching)",
  }),
  needsMoreThoughts: Schema.optional(Schema.Boolean).annotate({
    description: "If more thoughts are needed beyond estimate",
  }),
  isAction: Schema.optional(Schema.Boolean).annotate({
    description: "Whether this thought is an action step to be executed",
  }),
  actionCommand: Schema.optional(Schema.String).annotate({
    description: "The command to execute if isAction=true",
  }),
})

export const Parameters = Schema.Struct({
  thought: Schema.String,
  thoughtNumber: Schema.Number,
  totalThoughts: Schema.Number,
  nextThoughtNeeded: Schema.Boolean,
  isRevision: Schema.optional(Schema.Boolean),
  revisesThought: Schema.optional(Schema.Number),
  branchFromThought: Schema.optional(Schema.Number),
  branchId: Schema.optional(Schema.String),
  needsMoreThoughts: Schema.optional(Schema.Boolean),
  isAction: Schema.optional(Schema.Boolean),
  actionCommand: Schema.optional(Schema.String),
})

interface ThoughtEntry {
  thoughtNumber: number
  thought: string
  isRevision?: boolean
  revisesThought?: number
  branchFromThought?: number
  branchId?: string
  needsMoreThoughts?: boolean
  isAction?: boolean
  actionCommand?: string
}

// In-memory thought chains per session
const chains = new Map<string, ThoughtEntry[]>()

function formatChain(entries: ThoughtEntry[]): string {
  return entries
    .map((e) => {
      const prefix = e.isRevision
        ? `[REVISION of thought ${e.revisesThought}]`
        : e.branchFromThought
          ? `[BRANCH from thought ${e.branchFromThought}]`
          : `[Thought ${e.thoughtNumber}]`
      const action = e.isAction ? ` [ACTION${e.actionCommand ? `: ${e.actionCommand}` : ""}]` : ""
      return `${prefix}${action}\n${e.thought}`
    })
    .join("\n\n")
}

function formatPlan(entries: ThoughtEntry[]): string {
  const actions = entries.filter((e) => e.isAction)
  const plan = actions.map((e, i) => {
    return `Step ${i + 1}: ${e.thought}${e.actionCommand ? `\n   Command: ${e.actionCommand}` : ""}`
  })
  return `Action plan (${actions.length} steps):\n\n${plan.join("\n\n")}`
}

export const SequentialThinkingTool = Tool.define<typeof Parameters, {}, {}>(
  "sequential-thinking",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>) =>
        Effect.gen(function* () {
          const sessionID = "default"
          if (!chains.has(sessionID)) {
            chains.set(sessionID, [])
          }
          const chain = chains.get(sessionID)!

          const entry: ThoughtEntry = {
            thoughtNumber: params.thoughtNumber,
            thought: params.thought,
            isRevision: params.isRevision,
            revisesThought: params.revisesThought,
            branchFromThought: params.branchFromThought,
            branchId: params.branchId,
            needsMoreThoughts: params.needsMoreThoughts,
            isAction: params.isAction,
            actionCommand: params.actionCommand,
          }

          // If revision, replace the old thought
          if (params.isRevision && params.revisesThought) {
            const idx = chain.findIndex((e) => e.thoughtNumber === params.revisesThought)
            if (idx !== -1) {
              chain[idx] = entry
            }
          } else if (params.branchFromThought) {
            // Add as branch (append)
            chain.push(entry)
          } else {
            // Regular thought - if we already have this number, update; otherwise append
            const idx = chain.findIndex((e) => e.thoughtNumber === params.thoughtNumber)
            if (idx !== -1) {
              chain[idx] = entry
            } else {
              chain.push(entry)
            }
          }

          const formatted = formatChain(chain)
          const isComplete = !params.nextThoughtNeeded
          const hasActions = chain.some((e) => e.isAction)

          const output = isComplete
            ? hasActions
              ? `Reasoning chain complete with action plan.\n\n${formatted}\n\n${formatPlan(chain)}`
              : `Reasoning chain complete.\n\n${formatted}`
            : entry.thought

          return {
            title: isComplete
              ? hasActions
                ? `Completed reasoning chain (${chain.length} thoughts, ${chain.filter((e) => e.isAction).length} actions)`
                : `Completed reasoning chain (${chain.length} thoughts)`
              : `Thought ${params.thoughtNumber}/${params.totalThoughts}`,
            output,
            metadata: {},
          }
        }),
    } satisfies Tool.DefWithoutID<typeof Parameters, {}>
  }),
)
