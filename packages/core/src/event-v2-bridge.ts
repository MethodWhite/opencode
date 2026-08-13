import { EventV2 } from "./event"
import { LayerNode } from "./effect/layer-node"
import { Context, Effect, Layer } from "effect"

export class Service extends Context.Service<Service, EventV2.Interface>()("@opencode/EventV2Bridge") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const events = yield* EventV2.Service
    return Service.of(events)
  }),
)

export const defaultLayer = layer

export const node = LayerNode.make({ service: Service, layer, deps: [EventV2.node] })

export * as EventV2Bridge from "./event-v2-bridge"
