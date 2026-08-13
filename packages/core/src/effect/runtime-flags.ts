import { Context, Layer } from "effect"
import { LayerNode } from "./layer-node"

export interface Info {
  readonly autoShare: boolean
  readonly experimentalWorkspaces: boolean
}

export class Service extends Context.Service<Service, Info>()("@opencode/RuntimeFlags") {}

export const defaultLayer: Layer.Layer<Service> = Layer.succeed(Service, Service.of({
  autoShare: false,
  experimentalWorkspaces: false,
}))

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [] })

export * as RuntimeFlags from "./runtime-flags"
