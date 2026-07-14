import { LayerNode } from "../effect/layer-node"
import {
  Interface,
  Service,
  layer,
  type ExtendInput,
  type Info,
  type StartInput,
  type Status,
  type WaitInput,
  type WaitResult,
} from "../background-job"

export { Interface, Service }
export { layer as defaultLayer }
export type { ExtendInput, Info, StartInput, Status, WaitInput, WaitResult }

export const node = LayerNode.make(layer, [])

export * as BackgroundJob from "./job"
