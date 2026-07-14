import type { ConfigV1 } from "../v1/config/config"
import type { ConsoleState } from "../v1/config/console-state"
import { Context, Effect } from "effect"
import { serviceUse } from "../effect/service-use"

export type Info = ConfigV1.Info

export interface Interface {
  readonly get: () => Effect.Effect<Info>
  readonly getGlobal: () => Effect.Effect<Info>
  readonly getConsoleState: () => Effect.Effect<ConsoleState>
  readonly update: (config: Info) => Effect.Effect<void>
  readonly updateGlobal: (config: Info) => Effect.Effect<{ info: Info; changed: boolean }>
  readonly invalidate: () => Effect.Effect<void>
  readonly directories: () => Effect.Effect<string[]>
  readonly waitForDependencies: () => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Config") {}

export const use = serviceUse(Service)
