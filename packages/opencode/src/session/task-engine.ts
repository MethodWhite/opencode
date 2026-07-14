import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { SessionID } from "./schema"
import { Effect, Layer, Context, Option } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { eq, and, asc, sql } from "drizzle-orm"
import { TaskTable } from "@opencode-ai/core/session/sql"
import type { TaskID } from "@opencode-ai/core/session/sql"
import { EventV2Bridge } from "@opencode-ai/core/event-v2-bridge"
import { EventV2 } from "@opencode-ai/core/event"
import { Identifier } from "@opencode-ai/core/id/id"

export type TaskStatus = "pending" | "in_progress" | "blocked" | "completed" | "cancelled"
export type TaskPriority = "critical" | "high" | "medium" | "low"
export type TaskCategory = "feature" | "bug" | "security" | "refactor" | "chore" | "docs" | "design" | "research" | "general"

export interface TaskInfo {
  id: string
  session_id: SessionID
  parent_id?: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  category: TaskCategory
  tags?: string[]
  depends_on?: string[]
  estimated_hours?: number
  due_date?: number
  position: number
  rice_score?: number
  created_at: number
  updated_at: number
}

export interface CreateTaskInput {
  session_id: SessionID
  parent_id?: string
  title: string
  description?: string
  priority?: TaskPriority
  category?: TaskCategory
  tags?: string[]
  depends_on?: string[]
  estimated_hours?: number
  due_date?: number
}

export interface UpdateTaskInput {
  id: string
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  category?: TaskCategory
  tags?: string[]
  depends_on?: string[]
  estimated_hours?: number
  due_date?: number
  position?: number
}

export function computeRiceScore(reach: number, impact: number, confidence: number, effort: number): number {
  if (effort <= 0) return 0
  return (reach * impact * confidence) / effort
}

export const validTransitions: Record<TaskStatus, TaskStatus[]> = {
  pending: ["in_progress", "cancelled"],
  in_progress: ["completed", "blocked", "cancelled"],
  blocked: ["pending", "in_progress", "cancelled"],
  completed: ["in_progress"],
  cancelled: ["pending", "in_progress"],
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return validTransitions[from]?.includes(to) ?? false
}

export const Event = {
  Created: EventV2.define({ type: "task.created", schema: {} }),
  Updated: EventV2.define({ type: "task.updated", schema: {} }),
  Deleted: EventV2.define({ type: "task.deleted", schema: {} }),
  Reordered: EventV2.define({ type: "task.reordered", schema: {} }),
}

export interface Interface {
  readonly create: (input: CreateTaskInput) => Effect.Effect<TaskInfo>
  readonly update: (input: UpdateTaskInput) => Effect.Effect<TaskInfo>
  readonly delete: (taskID: string) => Effect.Effect<void>
  readonly get: (taskID: string) => Effect.Effect<Option.Option<TaskInfo>>
  readonly list: (sessionID: SessionID, status?: TaskStatus, category?: TaskCategory) => Effect.Effect<TaskInfo[]>
  readonly listByParent: (parentID: string) => Effect.Effect<TaskInfo[]>
  readonly reorder: (sessionID: SessionID, taskIDs: string[]) => Effect.Effect<void>
  readonly getBlocked: (taskID: string) => Effect.Effect<TaskInfo[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/TaskEngine") {}

function fromRow(row: any): TaskInfo {
  return {
    id: row.id,
    session_id: row.session_id,
    parent_id: row.parent_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    priority: row.priority,
    category: row.category,
    tags: row.tags ? row.tags.split(",").filter(Boolean) : undefined,
    depends_on: row.depends_on ? row.depends_on.split(",").filter(Boolean) : undefined,
    estimated_hours: row.estimated_hours ?? undefined,
    due_date: row.due_date ?? undefined,
    position: row.position,
    created_at: row.created_at ?? Date.now(),
    updated_at: row.updated_at ?? Date.now(),
  }
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const events = yield* EventV2Bridge.Service
    const { db } = yield* Database.Service

    const create = Effect.fn("Task.create")(function* (input: CreateTaskInput) {
      const id = Identifier.descending("job") as TaskID
      const now = Date.now()

      const existing = yield* (db as any)
        .select({ count: sql<number>`COUNT(*)` })
        .from(TaskTable as any)
        .where(eq(TaskTable.session_id, input.session_id))
        .all()
        .pipe(Effect.orDie)

      const task: TaskInfo = {
        id,
        session_id: input.session_id,
        parent_id: input.parent_id,
        title: input.title,
        description: input.description,
        status: "pending",
        priority: input.priority ?? "medium",
        category: input.category ?? "general",
        tags: input.tags,
        depends_on: input.depends_on,
        estimated_hours: input.estimated_hours,
        due_date: input.due_date,
        position: (existing[0]?.count ?? 0) + 1,
        created_at: now,
        updated_at: now,
      }

      yield* (db as any).insert(TaskTable).values(task).run().pipe(Effect.orDie)

      yield* events.publish(Event.Created, { sessionID: input.session_id, task })
      return task
    })

    const update = Effect.fn("Task.update")(function* (input: UpdateTaskInput) {
      const taskOption = yield* get(input.id)
      const task = Option.getOrNull(taskOption)
      if (!task) return yield* Effect.die(new Error(`Task not found: ${input.id}`))

      if (input.status && !canTransition(task.status, input.status)) {
        return yield* Effect.die(
          new Error(`Cannot transition task from '${task.status}' to '${input.status}'`),
        )
      }

      const updated: TaskInfo = {
        ...task,
        title: input.title ?? task.title,
        description: input.description ?? task.description,
        status: input.status ?? task.status,
        priority: input.priority ?? task.priority,
        category: input.category ?? task.category,
        tags: input.tags ?? task.tags,
        depends_on: input.depends_on ?? task.depends_on,
        estimated_hours: input.estimated_hours ?? task.estimated_hours,
        due_date: input.due_date ?? task.due_date,
        position: input.position ?? task.position,
      }

      yield* (db as any).update(TaskTable).set(updated).where(eq(TaskTable.id, input.id)).run().pipe(Effect.orDie)

      yield* events.publish(Event.Updated, { sessionID: task.session_id, task: updated })
      return updated
    })

    const del = Effect.fn("Task.delete")(function* (taskID: string) {
      const existing = yield* get(taskID)
      const task = Option.getOrNull(existing)
      if (!task) return
      yield* (db as any).delete(TaskTable).where(eq(TaskTable.id, taskID)).run().pipe(Effect.orDie)
      yield* events.publish(Event.Deleted, { sessionID: task.session_id, taskID })
    })

    const get = Effect.fn("Task.get")(function* (taskID: string) {
      const rows = yield* (db as any).select().from(TaskTable as any).where(eq(TaskTable.id, taskID)).all().pipe(Effect.orDie)
      if (rows.length === 0) return Option.none<TaskInfo>()
      return Option.some(fromRow(rows[0]))
    })

    const list = Effect.fn("Task.list")(function* (sessionID: SessionID, status?: TaskStatus, category?: TaskCategory) {
      const conditions = [eq(TaskTable.session_id, sessionID)]
      if (status) conditions.push(eq(TaskTable.status, status))
      if (category) conditions.push(eq(TaskTable.category, category))
      const rows = yield* (db as any).select().from(TaskTable as any).where(and(...conditions)).orderBy(asc(TaskTable.position)).all().pipe(Effect.orDie)
      return rows.map(fromRow)
    })

    const listByParent = Effect.fn("Task.listByParent")(function* (parentID: string) {
      const rows = yield* (db as any).select().from(TaskTable as any).where(eq(TaskTable.parent_id, parentID)).orderBy(asc(TaskTable.position)).all().pipe(Effect.orDie)
      return rows.map(fromRow)
    })

    const reorder = Effect.fn("Task.reorder")(function* (sessionID: SessionID, taskIDs: string[]) {
      yield* (db as any).transaction((tx) =>
        Effect.gen(function* () {
          for (const [idx, id] of taskIDs.entries()) {
            yield* tx.update(TaskTable).set({ position: idx }).where(and(eq(TaskTable.id, id), eq(TaskTable.session_id, sessionID))).run()
          }
        }),
      ).pipe(Effect.orDie)
      yield* events.publish(Event.Reordered, { sessionID, taskIDs })
    })

    const getBlocked = Effect.fn("Task.getBlocked")(function* (taskID: string) {
      const all = yield* list("" as SessionID)
      return all.filter((t) => t.depends_on?.includes(taskID))
    })

    return Service.of({ create, update, delete: del, get, list, listByParent, reorder, getBlocked })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(EventV2Bridge.defaultLayer), Layer.provide(Database.defaultLayer))
export const node = LayerNode.make(layer, [EventV2Bridge.node, Database.node])

export * as Task from "./task-engine"
