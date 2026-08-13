import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import DESCRIPTION_WRITE from "./todowrite.txt"
import { Todo } from "../session/todo"

export const Parameters = Schema.Struct({
  todos: Schema.optional(Schema.mutable(Schema.Array(Todo.Info))).annotate({
    description: "The full updated todo list (replaces the current list)",
  }),
  add: Schema.optional(Schema.mutable(Schema.Array(
    Schema.Struct({
      content: Schema.String.annotate({ description: "New task to append" }),
      priority: Schema.optional(Schema.String).annotate({ description: "high | medium | low" }),
    }),
  ))).annotate({ description: "Append new tasks without rewriting the list" }),
  complete: Schema.optional(Schema.mutable(Schema.Array(Schema.String))).annotate({
    description: "Mark tasks as completed by exact content",
  }),
  remove: Schema.optional(Schema.mutable(Schema.Array(Schema.String))).annotate({
    description: "Remove tasks by exact content",
  }),
})

type Metadata = {
  todos: Todo.Info[]
}

export const TodoWriteTool = Tool.define<typeof Parameters, Metadata, Todo.Service>(
  "todowrite",
  Effect.gen(function* () {
    const todo = yield* Todo.Service

    return {
      description: DESCRIPTION_WRITE,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<Metadata>) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "todowrite",
            patterns: ["*"],
            always: ["*"],
            metadata: {},
          })

          let next: Todo.Info[]
          if (params.todos) {
            // Reemplazo completo (comportamiento original)
            next = params.todos
          } else {
            // Ops granulares sobre la lista actual: manejo más fino de tareas.
            const current = yield* todo.get(ctx.sessionID)
            next = current.map((t) => ({ ...t }))
            for (const item of params.add ?? []) {
              next.push({
                content: item.content,
                status: "pending",
                priority: item.priority ?? "medium",
              })
            }
            for (const content of params.complete ?? []) {
              next = next.map((t) =>
                t.content === content ? { ...t, status: "completed" } : t,
              )
            }
            for (const content of params.remove ?? []) {
              next = next.filter((t) => t.content !== content)
            }
          }

          yield* todo.update({
            sessionID: ctx.sessionID,
            todos: next,
          })

          const done = next.filter((t) => t.status === "completed").length
          const active = next.filter((t) => t.status !== "completed" && t.status !== "cancelled").length

          return {
            title: `${done}/${next.length} done · ${active} active`,
            output: JSON.stringify(next, null, 2),
            metadata: {
              todos: next,
            },
          }
        }),
    } satisfies Tool.DefWithoutID<typeof Parameters, Metadata>
  }),
)
