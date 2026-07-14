import { Effect, Context, ScopedCache } from "effect"
import type { WorkspaceV2 } from "../workspace"
import type { ProjectSchema } from "../project/schema"

export interface InstanceContext {
  directory: string
  worktree: string
  project: {
    id: ProjectSchema.ID
    vcs?: string
  }
}

const TypeId = "~opencode/InstanceState"

export interface InstanceState<A, E = never, R = never> {
  readonly [TypeId]: typeof TypeId
  readonly cache: ScopedCache.ScopedCache<string, A, E, R>
}

export const InstanceRef = Context.Reference<InstanceContext | undefined>("~opencode/InstanceRef", {
  defaultValue: () => undefined,
})

export const WorkspaceRef = Context.Reference<WorkspaceV2.ID | undefined>("~opencode/WorkspaceRef", {
  defaultValue: () => undefined,
})

export const context = Effect.gen(function* () {
  const ctx = yield* InstanceRef
  if (!ctx) return yield* Effect.die(new Error("InstanceRef not provided"))
  return ctx
})

export const workspaceID = Effect.gen(function* () {
  return yield* WorkspaceRef
})

export const directory = Effect.map(context, (ctx) => ctx.directory)

export const InstanceState = {
  context,
  workspaceID,
  directory,
}
