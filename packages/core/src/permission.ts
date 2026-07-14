import { Context, Effect, Layer } from "effect"
import { EventV2 } from "../event"
import { PermissionV1 } from "../v1/permission"

export const Event = {
  Asked: EventV2.define({ type: "permission.asked", schema: PermissionV1.Request.fields }),
  Replied: EventV2.define({
    type: "permission.replied",
    schema: {
      sessionID: PermissionV1.Request.fields.sessionID,
      requestID: PermissionV1.ID,
      reply: PermissionV1.Reply,
    },
  }),
}

export interface Interface {
  readonly ask: (input: PermissionV1.AskInput) => Effect.Effect<void, PermissionV1.Error>
  readonly reply: (input: PermissionV1.ReplyInput) => Effect.Effect<void, PermissionV1.NotFoundError>
  readonly list: () => Effect.Effect<ReadonlyArray<PermissionV1.Request>>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Permission") {}

export const defaultLayer: Layer.Layer<Service, never, never> = Layer.effect(
export * as Permission from "."
  Service,
  Effect.succeed(
    Service.of({
      ask: () => Effect.void,
      reply: () => Effect.void,
      list: () => Effect.succeed([]),
    }),
  ),
)
