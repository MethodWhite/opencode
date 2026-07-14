import { EventV2 } from "@opencode-ai/core/event"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Context, Effect, Layer } from "effect"

export class Service extends Context.Service<Service, EventV2.Interface>()("@opencode/EventV2Bridge") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const events = yield* EventV2.Service
    return Service.of(events)
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(EventV2.defaultLayer))

export const node = LayerNode.make(layer, [EventV2.node])

export * as EventV2Bridge from "./event-v2-bridge"
